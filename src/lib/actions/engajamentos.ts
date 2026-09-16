"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { engajamentosContencioso, processos } from "@/db/schema";
import { requireSessao, requireEscritorio, somenteLeitura, escopoClientes } from "@/lib/session";
import { parseBRLToCents } from "@/lib/money";
import { registrarAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/result";

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

/** Escritório propõe honorários para uma demanda (contencioso = caso a caso). */
export async function proporEngajamento(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const processoId = String(formData.get("processoId") || "").trim();
  const p = await processoDoEscopo(processoId, escopoClientes(s));
  if (!p) return { ok: false, error: "Processo não encontrado." };

  const descricao = String(formData.get("descricao") || "").trim();
  if (!descricao) return { ok: false, error: "Descreva a demanda." };
  const valorCents = parseBRLToCents(String(formData.get("valor") || ""));
  const honorariosDescricao = String(formData.get("honorarios") || "").trim() || null;
  const exitoDescricao = String(formData.get("exito") || "").trim() || null;

  await db.insert(engajamentosContencioso).values({
    processoId,
    clienteId: p.clienteId,
    descricao,
    valorCents: valorCents ?? null,
    honorariosDescricao,
    exitoDescricao,
    status: "proposto",
    propostoPorId: s.id,
  });
  await registrarAudit({
    acao: "write",
    entidade: "engajamento",
    clienteId: p.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { descricao, valorCents },
  });
  revalidatePath(`/processos/${processoId}`);
  return { ok: true, message: "Proposta enviada." };
}

/** Aceitar/recusar a proposta (o polo decide; escritório pode registrar). */
export async function decidirEngajamento(id: string, aceitar: boolean): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const [e] = await db
    .select({ clienteId: engajamentosContencioso.clienteId, status: engajamentosContencioso.status, processoId: engajamentosContencioso.processoId })
    .from(engajamentosContencioso)
    .where(eq(engajamentosContencioso.id, id))
    .limit(1);
  if (!e) return { ok: false, error: "Proposta não encontrada." };
  const esc = escopoClientes(s);
  if (esc && !esc.includes(e.clienteId)) return { ok: false, error: "Sem acesso." };
  if (e.status !== "proposto") return { ok: false, error: "Proposta já decidida." };

  await db
    .update(engajamentosContencioso)
    .set(
      aceitar
        ? { status: "aceito", aceitoEm: new Date(), aceitoPorId: s.id }
        : { status: "recusado" },
    )
    .where(eq(engajamentosContencioso.id, id));
  await registrarAudit({
    acao: "write",
    entidade: "engajamento_decisao",
    entidadeId: id,
    clienteId: e.clienteId,
    atorId: s.id,
    atorPapel: s.escritorio ? "escritorio" : "polo",
    detalhe: { aceitar },
  });
  if (e.processoId) revalidatePath(`/processos/${e.processoId}`);
  return { ok: true };
}
