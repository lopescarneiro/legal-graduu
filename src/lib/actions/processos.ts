"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { processos, partes, prazos } from "@/db/schema";
import {
  requireSessao,
  requireEscritorio,
  somenteLeitura,
  ehEscritorio,
  escopoClientes,
} from "@/lib/session";
import { parseBRLToCents } from "@/lib/money";
import { garantirInscricao, moverEtapa } from "@/lib/funil";
import { calcularPrazo } from "@/lib/prazo-engine";
import { registrarAudit } from "@/lib/audit";
import type { Ramo } from "@/lib/funil-constantes";
import type { ActionResult } from "@/lib/actions/result";

const RAMOS: Ramo[] = ["trabalhista", "civel", "consumidor"];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAPEIS_POLO = ["reu", "autor", "terceiro"] as const;

/** Extras vindos da extração de citação por IA (já revisados pelo humano na tela). */
type ExtrasIa = {
  vara?: string;
  comarca?: string;
  tribunal?: string;
  dataCitacao?: string;
  papelDoPolo?: (typeof PAPEIS_POLO)[number];
  partes?: { nome: string; papel: string; ehPolo: boolean }[];
  prazo?: {
    descricao: string;
    dias: number;
    contagem: "uteis" | "corridos";
    meio: "djen" | "domicilio" | "oficial";
    dataPublicacao: string;
    tipo: "fatal_peremptorio" | "dilatorio";
  } | null;
};

function parseExtrasIa(raw: string): ExtrasIa | null {
  if (!raw.trim()) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return o && typeof o === "object" ? (o as ExtrasIa) : null;
  } catch {
    return null;
  }
}

const texto = (v: unknown): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};

export async function criarProcesso(
  formData: FormData,
): Promise<ActionResult & { id?: string }> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  // Abrir processo é ato do ESCRITÓRIO (todas as demais mutações de processo já são
  // escritório-only). O polo não abre processo pleno no funil.
  if (!ehEscritorio(s)) return { ok: false, error: "Apenas o escritório abre processos." };

  const ramo = String(formData.get("ramo") || "") as Ramo;
  if (!RAMOS.includes(ramo)) return { ok: false, error: "Ramo inválido." };

  const clienteId = String(formData.get("clienteId") || "").trim() || null;
  if (!clienteId) return { ok: false, error: "Selecione o cliente." };

  const numeroCnj = String(formData.get("numeroCnj") || "").trim() || null;
  const tipoAcao = String(formData.get("tipoAcao") || "").trim() || null;
  const valorCausaCents = parseBRLToCents(String(formData.get("valorCausa") || ""));

  const extras = parseExtrasIa(String(formData.get("iaJson") || ""));
  const papelDoPolo =
    extras?.papelDoPolo && PAPEIS_POLO.includes(extras.papelDoPolo) ? extras.papelDoPolo : "reu";
  const dataCitacao =
    extras?.dataCitacao && DATA_RE.test(extras.dataCitacao) ? extras.dataCitacao : null;

  const [row] = await db
    .insert(processos)
    .values({
      clienteId,
      ramo,
      numeroCnj,
      tipoAcao,
      valorCausaCents: valorCausaCents ?? null,
      papelDoPolo,
      vara: texto(extras?.vara),
      comarca: texto(extras?.comarca),
      tribunal: texto(extras?.tribunal),
      dataCitacao,
      situacao: "ativo",
      advogadoResponsavelId: ehEscritorio(s) ? s.id : null,
    })
    .returning({ id: processos.id });

  if (row) await garantirInscricao(row.id, ramo, clienteId);

  // Partes e prazo extraídos pela IA (revisados na tela) — só se veio processo.
  let prazoSugerido: string | null = null;
  if (row && extras) {
    const linhasPartes = (extras.partes ?? [])
      .filter((p) => p && typeof p.nome === "string" && p.nome.trim() !== "")
      .slice(0, 20)
      .map((p) => ({
        processoId: row.id,
        clienteId,
        papel: (typeof p.papel === "string" && p.papel.trim()) || "parte",
        nome: p.nome.trim().slice(0, 300),
        ehPolo: p.ehPolo === true,
      }));
    if (linhasPartes.length > 0) await db.insert(partes).values(linhasPartes);

    const pr = extras.prazo;
    if (pr && Number(pr.dias) > 0) {
      const meio = pr.meio === "domicilio" ? "domicilio" : pr.meio === "oficial" ? "oficial" : "djen";
      const contagem = pr.contagem === "corridos" ? "corridos" : "uteis";
      const dataPublicacao = DATA_RE.test(pr.dataPublicacao) ? pr.dataPublicacao : null;
      const dias = Math.min(Math.trunc(Number(pr.dias)), 90);
      const res = calcularPrazo({ meio, dataPublicacao, dias, contagem, comarcaConhecida: false });
      await db.insert(prazos).values({
        processoId: row.id,
        clienteId,
        tipo: pr.tipo === "dilatorio" ? "dilatorio" : "fatal_peremptorio",
        descricao: texto(pr.descricao) ?? "Prazo extraído da citação (IA) — confira.",
        meioComunicacao: meio,
        dataPublicacao,
        dias,
        contagem,
        dataSugerida: res.dataSugerida,
        nivelConfianca: res.nivelConfianca,
        motivosIncerteza: res.motivosIncerteza,
        dataVencimento: null, // só após confirmação humana
        status: res.dataSugerida ? "aberto" : "a_calcular",
        responsavelId: ehEscritorio(s) ? s.id : null,
        fonte: "ia",
      });
      prazoSugerido = res.dataSugerida;
    }
  }

  await registrarAudit({
    acao: "write",
    entidade: "processo",
    entidadeId: row?.id,
    clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
    detalhe: { ramo, numeroCnj, fonte: extras ? "ia" : "manual", prazoSugerido },
  });
  revalidatePath("/processos");
  return { ok: true, id: row?.id, message: "Processo criado." };
}

const SITUACOES = ["ativo", "suspenso", "encerrado", "arquivado"] as const;

/** Edita o processo (CNJ, tipo, valor, vara, comarca, situação). Só o escritório. */
export async function atualizarProcesso(id: string, formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const [p] = await db
    .select({ clienteId: processos.clienteId })
    .from(processos)
    .where(eq(processos.id, id))
    .limit(1);
  if (!p) return { ok: false, error: "Processo não encontrado." };
  const esc = escopoClientes(s);
  if (esc && !esc.includes(p.clienteId)) return { ok: false, error: "Sem acesso." };

  const situacao = String(formData.get("situacao") || "ativo");
  if (!SITUACOES.includes(situacao as (typeof SITUACOES)[number])) {
    return { ok: false, error: "Situação inválida." };
  }
  const numeroCnj = String(formData.get("numeroCnj") || "").trim() || null;
  const tipoAcao = String(formData.get("tipoAcao") || "").trim() || null;
  const vara = String(formData.get("vara") || "").trim() || null;
  const comarca = String(formData.get("comarca") || "").trim() || null;
  const valorCausaCents = parseBRLToCents(String(formData.get("valorCausa") || ""));

  await db
    .update(processos)
    .set({
      situacao: situacao as (typeof SITUACOES)[number],
      numeroCnj,
      tipoAcao,
      vara,
      comarca,
      valorCausaCents: valorCausaCents ?? null,
    })
    .where(eq(processos.id, id));
  await registrarAudit({
    acao: "write",
    entidade: "processo",
    entidadeId: id,
    clienteId: p.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { situacao, numeroCnj },
  });
  revalidatePath(`/processos/${id}`);
  revalidatePath("/processos");
  return { ok: true, message: "Processo atualizado." };
}

/** Mover card no board — operação do ESCRITÓRIO. */
export async function moverEtapaProcesso(
  inscricaoId: string,
  etapaDestinoId: string,
): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const esc = escopoClientes(s);
  const r = await moverEtapa({
    inscricaoId,
    etapaDestinoId,
    clientesPermitidos: esc,
    usuarioId: s.id,
    checarFatalPendente: true,
  });
  if (!r.ok) return r;
  revalidatePath("/processos");
  return { ok: true };
}
