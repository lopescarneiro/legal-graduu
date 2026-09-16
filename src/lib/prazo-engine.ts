import "server-only";
import { format, parseISO } from "date-fns";
import { ehDiaUtil } from "./dates";

/**
 * Motor de prazo processual — MVP determinístico com CONTRATO DE CONFIANÇA.
 *
 * Não devolve só uma data: devolve `{ dataSugerida, nivelConfianca, motivosIncerteza[] }`.
 * A regra de ouro é o oposto do "falha calada": quando há incerteza (comarca fora de
 * cobertura, via Domicílio, feriados municipais/suspensões desconhecidos), a confiança
 * cai e os motivos aparecem — nunca um número silencioso passando por certo. A palavra
 * final é HUMANA (o escritório confirma a data; ver actions/prazos.ts, revisão E3/E6).
 */

const RECESSO = "20/12–20/01 (CPC art. 220)";

/** Recesso forense: 20/12 a 20/01. */
function emRecesso(d: Date): boolean {
  const m = d.getMonth() + 1;
  const dia = d.getDate();
  return (m === 12 && dia >= 20) || (m === 1 && dia <= 20);
}

/** Dia útil forense = dia útil (sem fim de semana/feriado nacional) e fora do recesso. */
function diaUtilForense(d: Date): boolean {
  return ehDiaUtil(d) && !emRecesso(d);
}

/** Data `n` dias úteis forenses após `de`. */
function apos(de: Date, n: number): Date {
  const r = new Date(de);
  let restantes = Math.max(0, n);
  while (restantes > 0) {
    r.setDate(r.getDate() + 1);
    if (diaUtilForense(r)) restantes--;
  }
  return r;
}

export type ResultadoPrazo = {
  dataSugerida: string | null; // 'YYYY-MM-DD' ou null (não deu p/ calcular → cálculo manual)
  nivelConfianca: number; // 0-100
  motivosIncerteza: string[];
};

export function calcularPrazo(input: {
  meio: "djen" | "domicilio" | "oficial";
  dataPublicacao: string | null;
  dias: number;
  contagem: "uteis" | "corridos";
  comarcaConhecida?: boolean;
}): ResultadoPrazo {
  if (!input.dataPublicacao || !/^\d{4}-\d{2}-\d{2}$/.test(input.dataPublicacao) || input.dias <= 0) {
    return {
      dataSugerida: null,
      nivelConfianca: 0,
      motivosIncerteza: ["Sem data de publicação/dias válidos — calcular manualmente."],
    };
  }

  const motivos: string[] = [];
  let confianca = 100;

  if (input.meio === "domicilio") {
    motivos.push(
      "Via Domicílio Judicial Eletrônico: início tem regra própria (CPC 231, X) — confira a contagem.",
    );
    confianca -= 40;
  } else if (input.meio === "oficial") {
    motivos.push("Comunicação por oficial de justiça — confira a data de juntada/ciência.");
    confianca -= 20;
  }

  // Início = 1º dia útil forense após a publicação (DJEN: CPC 224 §2º/§3º).
  const inicio = apos(parseISO(input.dataPublicacao), 1);

  let venc: Date;
  if (input.contagem === "uteis") {
    venc = apos(inicio, input.dias - 1);
    motivos.push(`Considera fins de semana, feriados nacionais e recesso (${RECESSO}).`);
    motivos.push("NÃO considera feriados municipais nem suspensões locais — confira na comarca.");
    confianca -= 15;
  } else {
    venc = new Date(inicio);
    venc.setDate(venc.getDate() + (input.dias - 1));
  }

  if (input.comarcaConhecida === false) confianca -= 10;

  confianca = Math.max(0, Math.min(100, confianca));
  return { dataSugerida: format(venc, "yyyy-MM-dd"), nivelConfianca: confianca, motivosIncerteza: motivos };
}
