"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { consultas } from "@/db/schema";
import {
  requireSessao,
  requireEscritorio,
  somenteLeitura,
  ehEscritorio,
  escopoClientes,
} from "@/lib/session";
import { proximoDiaUtilApos } from "@/lib/dates";
import { registrarAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/result";

export async function criarConsulta(formData: FormData): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const assunto = String(formData.get("assunto") || "").trim().slice(0, 200);
  const pergunta = String(formData.get("pergunta") || "").trim();
  if (!assunto || !pergunta) return { ok: false, error: "Preencha assunto e pergunta." };

  let clienteId: string | null;
  if (ehEscritorio(s)) {
    clienteId = String(formData.get("clienteId") || "").trim() || null;
    if (!clienteId) return { ok: false, error: "Selecione o cliente." };
  } else {
    clienteId = s.clienteId;
    if (!clienteId) return { ok: false, error: "Sessão sem cliente." };
  }

  await db.insert(consultas).values({
    clienteId,
    criadaPorId: s.id,
    assunto,
    pergunta,
    status: "aberta",
    slaVenceEm: proximoDiaUtilApos(new Date(), 2), // 48h úteis
  });
  await registrarAudit({
    acao: "write",
    entidade: "consulta",
    clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
  });
  revalidatePath("/consultas");
  return { ok: true, message: "Consulta enviada." };
}

export async function responderConsulta(id: string, resposta: string): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  if (!resposta.trim()) return { ok: false, error: "Escreva a resposta." };

  const [c] = await db
    .select({ clienteId: consultas.clienteId })
    .from(consultas)
    .where(eq(consultas.id, id))
    .limit(1);
  if (!c) return { ok: false, error: "Consulta não encontrada." };
  const escR = escopoClientes(s);
  if (escR && !escR.includes(c.clienteId)) return { ok: false, error: "Sem acesso." };

  await db
    .update(consultas)
    .set({
      resposta: resposta.trim(),
      respondidaPorId: s.id,
      respondidaEm: new Date(),
      status: "respondida",
    })
    .where(eq(consultas.id, id));
  await registrarAudit({
    acao: "write",
    entidade: "consulta_resposta",
    entidadeId: id,
    clienteId: c.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
  });
  revalidatePath("/consultas");
  return { ok: true };
}

export async function encerrarConsulta(id: string): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const [c] = await db
    .select({ clienteId: consultas.clienteId })
    .from(consultas)
    .where(eq(consultas.id, id))
    .limit(1);
  if (!c) return { ok: false, error: "Consulta não encontrada." };
  const esc = escopoClientes(s);
  if (esc && !esc.includes(c.clienteId)) return { ok: false, error: "Sem acesso." };
  await db.update(consultas).set({ status: "encerrada" }).where(eq(consultas.id, id));
  await registrarAudit({
    acao: "write",
    entidade: "consulta_encerramento",
    entidadeId: id,
    clienteId: c.clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
  });
  revalidatePath("/consultas");
  return { ok: true };
}
