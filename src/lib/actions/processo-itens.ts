"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { processos, andamentos, audiencias, partes } from "@/db/schema";
import { requireEscritorio, somenteLeitura, escopoClientes } from "@/lib/session";
import { todayISO } from "@/lib/dates";
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

export async function registrarAndamento(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const processoId = String(formData.get("processoId") || "").trim();
  const p = await processoDoEscopo(processoId, escopoClientes(s));
  if (!p) return { ok: false, error: "Processo não encontrado." };

  const dataRaw = String(formData.get("data") || "").trim();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dataRaw) ? dataRaw : todayISO();
  const descricao = String(formData.get("descricao") || "").trim();
  if (!descricao) return { ok: false, error: "Descreva o andamento." };

  await db.insert(andamentos).values({ processoId, clienteId: p.clienteId, data, descricao, origem: "manual" });
  await registrarAudit({ acao: "write", entidade: "andamento", clienteId: p.clienteId, atorId: s.id, atorPapel: "escritorio" });
  revalidatePath(`/processos/${processoId}`);
  return { ok: true, message: "Andamento registrado." };
}

export async function registrarAudiencia(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const processoId = String(formData.get("processoId") || "").trim();
  const p = await processoDoEscopo(processoId, escopoClientes(s));
  if (!p) return { ok: false, error: "Processo não encontrado." };

  const dataHoraRaw = String(formData.get("dataHora") || "").trim();
  const dt = dataHoraRaw ? new Date(dataHoraRaw) : null;
  if (!dt || Number.isNaN(dt.getTime())) return { ok: false, error: "Informe data e hora." };
  const tipo = String(formData.get("tipo") || "conciliacao");
  const modalidade = String(formData.get("modalidade") || "presencial");
  const vara = String(formData.get("vara") || "").trim() || null;
  const prepostoNome = String(formData.get("prepostoNome") || "").trim() || null;
  const prepostoWhatsapp = String(formData.get("prepostoWhatsapp") || "").trim() || null;

  await db.insert(audiencias).values({
    processoId,
    clienteId: p.clienteId,
    tipo: tipo as "conciliacao" | "una" | "instrucao" | "outra",
    dataHora: dt,
    modalidade: modalidade as "presencial" | "virtual",
    vara,
    prepostoNome,
    prepostoWhatsapp,
  });
  await registrarAudit({ acao: "write", entidade: "audiencia", clienteId: p.clienteId, atorId: s.id, atorPapel: "escritorio" });
  revalidatePath(`/processos/${processoId}`);
  return { ok: true, message: "Audiência registrada." };
}

export async function registrarParte(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const processoId = String(formData.get("processoId") || "").trim();
  const p = await processoDoEscopo(processoId, escopoClientes(s));
  if (!p) return { ok: false, error: "Processo não encontrado." };

  const papel = String(formData.get("papel") || "").trim();
  const nome = String(formData.get("nome") || "").trim();
  if (!papel || !nome) return { ok: false, error: "Informe papel e nome." };
  const cpfCnpj = String(formData.get("cpfCnpj") || "").trim() || null;
  const ehPolo = formData.get("ehPolo") === "on";

  await db.insert(partes).values({ processoId, clienteId: p.clienteId, papel, nome, cpfCnpj, ehPolo });
  await registrarAudit({ acao: "write", entidade: "parte", clienteId: p.clienteId, atorId: s.id, atorPapel: "escritorio" });
  revalidatePath(`/processos/${processoId}`);
  return { ok: true, message: "Parte registrada." };
}
