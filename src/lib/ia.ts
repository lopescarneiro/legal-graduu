import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Camada de IA do Legal Graduu. A chave (ANTHROPIC_API_KEY) vive só no ambiente
 * (Vercel) — nunca no código/chat. O model id é fixo aqui (convenção da suíte).
 *
 * Regra jurídica: a IA é SEMPRE assistiva. Extração de citação = intake que FALHA
 * RUIDOSA (nunca "calada→null"); a data de prazo passa pelo motor de confiança +
 * validação humana. Avaliação de Compliance é advisory (nunca carimba "em dia").
 * Documento SIGILOSO não entra no pipeline de IA (sigilo + transferência
 * internacional, art. 33 LGPD) — a barreira fica em quem chama.
 */
const MODELO = "claude-opus-4-8";

export const IA_DISPONIVEL = !!process.env.ANTHROPIC_API_KEY;
export function iaConfigurada(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ===========================================================================
// EXTRAÇÃO DE CITAÇÃO (intake de Processos)
// ===========================================================================
export type ParteExtraida = { nome: string; papel: string; ehPolo: boolean };
export type PrazoExtraido = {
  descricao: string;
  dias: number;
  contagem: "uteis" | "corridos";
  meio: "djen" | "domicilio" | "oficial";
  dataPublicacao: string; // 'YYYY-MM-DD' ou ""
  tipo: "fatal_peremptorio" | "dilatorio";
};
export type AudienciaExtraida = { data: string; hora: string; tipo: string; modalidade: string };

export type CitacaoExtraida = {
  ramo: "trabalhista" | "civel" | "consumidor" | "";
  numeroCnj: string;
  tipoAcao: string;
  valorCausaReais: number;
  tribunal: string;
  vara: string;
  comarca: string;
  papelDoPolo: "reu" | "autor" | "terceiro" | "";
  dataCitacao: string; // 'YYYY-MM-DD' ou ""
  partes: ParteExtraida[];
  prazo: PrazoExtraido | null;
  audiencia: AudienciaExtraida | null;
  observacoes: string;
};

const PROMPT_CITACAO = `Você é assistente jurídico de um escritório brasileiro. Recebe a CITAÇÃO/NOTIFICAÇÃO inicial de um processo em que o cliente (um POLO de ensino EAD, pessoa jurídica) é parte. Extraia os dados para abrir o processo no sistema.

Regras:
- Não invente. Campo não encontrado → string vazia "" (ou 0 para número, ou null para objetos).
- Datas no formato AAAA-MM-DD. Valores monetários em REAIS como número (ex.: "R$ 15.000,00" -> 15000.00).
- ramo: classifique em "trabalhista" (Justiça do Trabalho, reclamação trabalhista, verbas), "consumidor" (relação de consumo, aluno/consumidor, Procon, Lei 9.099/JEC) ou "civel" (demais empresariais/cível). Se não der para decidir, "".
- papelDoPolo: o papel do CLIENTE (o polo) no processo — "reu" (reclamada/requerida, o mais comum), "autor" (reclamante/requerente) ou "terceiro".
- partes: liste as partes com nome e papel (ex.: "reclamante", "reclamada", "autor", "réu"); marque ehPolo=true na parte que é o cliente/polo (a pessoa jurídica ré, tipicamente).
- prazo: o prazo de resposta do réu se indicado (ex.: contestação 15 dias úteis no cível; na Justiça do Trabalho a defesa costuma ser na audiência — nesse caso prazo pode ser null e a audiência é o marco). dataPublicacao = data da ciência/publicação se houver; meio = "djen" (Diário eletrônico) por padrão, "domicilio" (Domicílio Judicial Eletrônico) ou "oficial" (oficial de justiça); contagem = "uteis" no cível/consumidor. tipo = "fatal_peremptorio" para prazos de defesa/recurso.
- audiencia: se designada, extraia data (AAAA-MM-DD), hora (HH:MM), tipo (ex.: "conciliação", "instrução", "una") e modalidade ("presencial"/"virtual").
- observacoes: aponte incertezas, ambiguidades ou dados que o escritório deve conferir. NUNCA afirme certeza que o documento não dá.`;

const SCHEMA_CITACAO = {
  type: "object",
  properties: {
    ramo: { type: "string", enum: ["trabalhista", "civel", "consumidor", ""] },
    numeroCnj: { type: "string" },
    tipoAcao: { type: "string" },
    valorCausaReais: { type: "number" },
    tribunal: { type: "string" },
    vara: { type: "string" },
    comarca: { type: "string" },
    papelDoPolo: { type: "string", enum: ["reu", "autor", "terceiro", ""] },
    dataCitacao: { type: "string" },
    partes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          papel: { type: "string" },
          ehPolo: { type: "boolean" },
        },
        required: ["nome", "papel", "ehPolo"],
        additionalProperties: false,
      },
    },
    // Objetos sempre presentes (evita union nullable no json_schema estrito).
    // "sem prazo" = dias 0; "sem audiência" = data "".
    prazo: {
      type: "object",
      properties: {
        descricao: { type: "string" },
        dias: { type: "integer" },
        contagem: { type: "string", enum: ["uteis", "corridos"] },
        meio: { type: "string", enum: ["djen", "domicilio", "oficial"] },
        dataPublicacao: { type: "string" },
        tipo: { type: "string", enum: ["fatal_peremptorio", "dilatorio"] },
      },
      required: ["descricao", "dias", "contagem", "meio", "dataPublicacao", "tipo"],
      additionalProperties: false,
    },
    audiencia: {
      type: "object",
      properties: {
        data: { type: "string" },
        hora: { type: "string" },
        tipo: { type: "string" },
        modalidade: { type: "string" },
      },
      required: ["data", "hora", "tipo", "modalidade"],
      additionalProperties: false,
    },
    observacoes: { type: "string" },
  },
  required: [
    "ramo",
    "numeroCnj",
    "tipoAcao",
    "valorCausaReais",
    "tribunal",
    "vara",
    "comarca",
    "papelDoPolo",
    "dataCitacao",
    "partes",
    "prazo",
    "audiencia",
    "observacoes",
  ],
  additionalProperties: false,
} as const;

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const data = (v: unknown): string => (DATA_RE.test(s(v)) ? s(v) : "");

/**
 * Lê a citação (PDF ou imagem) e extrai os dados de abertura do processo via
 * Claude (visão p/ imagem, document block p/ PDF) com saída estruturada.
 * FALHA RUIDOSA: lança em vez de devolver silenciosamente vazio.
 */
export async function extrairCitacao(file: File): Promise<CitacaoExtraida> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Análise por IA não configurada (defina ANTHROPIC_API_KEY).");
  }

  const client = new Anthropic();
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const fonte =
    file.type === "application/pdf"
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: b64 },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: b64,
          },
        };

  const response = await client.messages.create({
    model: MODELO,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: [fonte, { type: "text", text: PROMPT_CITACAO }] }],
    output_config: { format: { type: "json_schema", schema: SCHEMA_CITACAO } },
  });

  const bloco = response.content.find((b) => b.type === "text");
  if (!bloco || bloco.type !== "text") {
    throw new Error("Não consegui interpretar a citação. Tente outro arquivo ou lance manualmente.");
  }

  let out: Record<string, unknown>;
  try {
    out = JSON.parse(bloco.text) as Record<string, unknown>;
  } catch {
    throw new Error("A leitura da citação voltou em formato inesperado. Lance manualmente.");
  }

  const ramoOk = ["trabalhista", "civel", "consumidor"];
  const ramo = ramoOk.includes(s(out.ramo)) ? (s(out.ramo) as CitacaoExtraida["ramo"]) : "";
  const papelOk = ["reu", "autor", "terceiro"];
  const papelDoPolo = papelOk.includes(s(out.papelDoPolo))
    ? (s(out.papelDoPolo) as CitacaoExtraida["papelDoPolo"])
    : "";

  const partesRaw = Array.isArray(out.partes) ? (out.partes as Record<string, unknown>[]) : [];
  const partes: ParteExtraida[] = partesRaw
    .map((p) => ({ nome: s(p.nome), papel: s(p.papel), ehPolo: p.ehPolo === true }))
    .filter((p) => p.nome !== "");

  let prazo: PrazoExtraido | null = null;
  const pr = out.prazo as Record<string, unknown> | null | undefined;
  if (pr && typeof pr === "object") {
    const dias = Math.trunc(Number(pr.dias) || 0);
    if (dias > 0) {
      prazo = {
        descricao: s(pr.descricao),
        dias: Math.min(dias, 90),
        contagem: pr.contagem === "corridos" ? "corridos" : "uteis",
        meio: pr.meio === "domicilio" ? "domicilio" : pr.meio === "oficial" ? "oficial" : "djen",
        dataPublicacao: data(pr.dataPublicacao),
        tipo: pr.tipo === "dilatorio" ? "dilatorio" : "fatal_peremptorio",
      };
    }
  }

  let audiencia: AudienciaExtraida | null = null;
  const au = out.audiencia as Record<string, unknown> | null | undefined;
  if (au && typeof au === "object" && data(au.data)) {
    audiencia = {
      data: data(au.data),
      hora: s(au.hora),
      tipo: s(au.tipo),
      modalidade: s(au.modalidade),
    };
  }

  return {
    ramo,
    numeroCnj: s(out.numeroCnj),
    tipoAcao: s(out.tipoAcao),
    valorCausaReais: Math.max(0, Number(out.valorCausaReais) || 0),
    tribunal: s(out.tribunal),
    vara: s(out.vara),
    comarca: s(out.comarca),
    papelDoPolo,
    dataCitacao: data(out.dataCitacao),
    partes,
    prazo,
    audiencia,
    observacoes: s(out.observacoes),
  };
}
