"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { prazos, processos } from "@/db/schema";
import { requireEscritorio, somenteLeitura, escopoClientes } from "@/lib/session";
import { calcularPrazo } from "@/lib/prazo-engine";
import { registrarAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/result";

const TIPOS = ["fatal_peremptorio", "dilatorio"] as const;
const MEIOS = ["djen", "domicilio", "oficial"] as const;
const CONTAGENS = ["uteis", "corridos"] as const;

async function processoDoEscopo(
  processoId: string,
  esc: string[] | null,
): Promise<{ clienteId: string } | null> {
  const [p] = await db
    .select({ clienteId: processos.clienteId })
    .from(processos)
    .where(eq(processos.id, processoId))
    .limit(1);
  if (!p) return null;
  if (esc && !esc.includes(p.clienteId)) return null;
  return p;
}

export async function criarPrazo(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const processoId = String(formData.get("processoId") || "").trim();
  const p = await processoDoEscopo(processoId, escopoClientes(s));
  if (!p) return { ok: false, error: "Processo não encontrado." };

  const tipo = String(formData.get("tipo") || "fatal_peremptorio");
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) return { ok: false, error: "Tipo inválido." };
  const meio = String(formData.get("meio") || "djen");
  if (!MEIOS.includes(meio as (typeof MEIOS)[number])) return { ok: false, error: "Meio inválido." };
  const contagem = String(formData.get("contagem") || "uteis");
  if (!CONTAGENS.includes(contagem as (typeof CONTAGENS)[number])) {
    return { ok: false, error: "Contagem inválida." };
  }
  const dias = Number(formData.get("dias") || 0);
  if (!Number.isFinite(dias) || dias <= 0) return { ok: false, error: "Informe os dias do prazo." };
  const dataPublicacaoRaw = String(formData.get("dataPublicacao") || "").trim();
  const dataPublicacao = /^\d{4}-\d{2}-\d{2}$/.test(dataPublicacaoRaw) ? dataPublicacaoRaw : null;
  const descricao = String(formData.get("descricao") || "").trim() || null;

  const res = calcularPrazo({
    meio: meio as (typeof MEIOS)[number],
    dataPublicacao,
    dias,
    contagem: contagem as (typeof CONTAGENS)[number],
    comarcaConhecida: false,
  });

  await db.insert(prazos).values({
    processoId,
    clienteId: p.clienteId,
    tipo: tipo as (typeof TIPOS)[number],
    descricao,
    meioComunicacao: meio as (typeof MEIOS)[number],
    dataPublicacao,
    dias,
    contagem: contagem as (typeof CONTAGENS)[number],
    dataSugerida: res.dataSugerida,
    nivelConfianca: res.nivelConfianca,
    motivosIncerteza: res.motivosIncerteza,
    dataVencimento: null, // só após a confirmação humana
    status: res.dataSugerida ? "aberto" : "a_calcular",
    responsavelId: s.id,
    fonte: "manual",
  });
  await registrarAudit({
    acao: "write",
    entidade: "prazo",
    clienteId: p.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { tipo, dias, sugerido: res.dataSugerida, confianca: res.nivelConfianca },
  });
  revalidatePath(`/processos/${processoId}`);
  revalidatePath("/prazos");
  return { ok: true, message: "Prazo calculado (aguardando confirmação)." };
}

/**
 * Confirmação HUMANA do prazo (evento imutável de auditoria — revisão E6). Registra
 * ator, valor da máquina × valor confirmado. Só a partir daqui o `dataVencimento` vale.
 */
export async function confirmarPrazo(id: string, dataConfirmada: string): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataConfirmada)) return { ok: false, error: "Data inválida." };

  const [pz] = await db
    .select({ clienteId: prazos.clienteId, dataSugerida: prazos.dataSugerida })
    .from(prazos)
    .where(eq(prazos.id, id))
    .limit(1);
  if (!pz) return { ok: false, error: "Prazo não encontrado." };
  const esc = escopoClientes(s);
  if (esc && !esc.includes(pz.clienteId)) return { ok: false, error: "Sem acesso." };

  await db
    .update(prazos)
    .set({
      valorConfirmado: dataConfirmada,
      dataVencimento: dataConfirmada,
      validadoPorId: s.id,
      validadoEm: new Date(),
      status: "aberto",
    })
    .where(eq(prazos.id, id));
  await registrarAudit({
    acao: "write",
    entidade: "prazo_validacao",
    entidadeId: id,
    clienteId: pz.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { valorMaquina: pz.dataSugerida, valorConfirmado: dataConfirmada },
  });
  revalidatePath("/prazos");
  return { ok: true, message: "Prazo confirmado." };
}

/** Baixa do prazo — cumprido ou perdido. Evento auditado. Só o escritório. */
async function baixarPrazo(
  id: string,
  novoStatus: "cumprido" | "perdido",
  motivo?: string,
): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const [pz] = await db
    .select({ clienteId: prazos.clienteId, processoId: prazos.processoId })
    .from(prazos)
    .where(eq(prazos.id, id))
    .limit(1);
  if (!pz) return { ok: false, error: "Prazo não encontrado." };
  const esc = escopoClientes(s);
  if (esc && !esc.includes(pz.clienteId)) return { ok: false, error: "Sem acesso." };

  await db.update(prazos).set({ status: novoStatus }).where(eq(prazos.id, id));
  await registrarAudit({
    acao: "write",
    entidade: "prazo_baixa",
    entidadeId: id,
    clienteId: pz.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { resultado: novoStatus, motivo: motivo ?? null },
  });
  revalidatePath(`/processos/${pz.processoId}`);
  revalidatePath("/prazos");
  return { ok: true, message: novoStatus === "cumprido" ? "Prazo cumprido." : "Prazo marcado como perdido." };
}

export async function cumprirPrazo(id: string): Promise<ActionResult> {
  return baixarPrazo(id, "cumprido");
}

export async function marcarPrazoPerdido(id: string, motivo?: string): Promise<ActionResult> {
  return baixarPrazo(id, "perdido", motivo);
}
