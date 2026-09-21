"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { reunioes } from "@/db/schema";
import { requireSessao, somenteLeitura, ehEscritorio, escopoClientes } from "@/lib/session";
import { saoPauloParaUTC, competenciaSaoPaulo } from "@/lib/dates";
import { registrarAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/result";

export async function agendarReuniao(formData: FormData): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const dataHoraRaw = String(formData.get("dataHora") || "").trim();
  const dt = saoPauloParaUTC(dataHoraRaw); // datetime-local interpretado como Brasília
  if (!dt) return { ok: false, error: "Informe data e hora." };
  if (dt.getTime() < Date.now()) return { ok: false, error: "A reunião precisa ser no futuro." };
  const tipo = String(formData.get("tipo") || "").trim() || null;
  const link = String(formData.get("link") || "").trim() || null;

  let clienteId: string | null;
  if (ehEscritorio(s)) {
    clienteId = String(formData.get("clienteId") || "").trim() || null;
    if (!clienteId) return { ok: false, error: "Selecione o cliente." };
  } else {
    clienteId = s.clienteId;
    if (!clienteId) return { ok: false, error: "Sessão sem cliente." };
  }

  const competencia = competenciaSaoPaulo(dataHoraRaw); // mês pelo relógio de Brasília
  // Regra do plano: 2 reuniões/mês, não cumulativas (canceladas não contam).
  const [{ n }] = await db
    .select({ n: count() })
    .from(reunioes)
    .where(
      and(
        eq(reunioes.clienteId, clienteId),
        eq(reunioes.competencia, competencia),
        ne(reunioes.status, "cancelada"),
      ),
    );
  if (Number(n) >= 2) {
    return { ok: false, error: "Limite de 2 reuniões neste mês já atingido (não cumulativo)." };
  }

  await db.insert(reunioes).values({
    clienteId,
    dataHora: dt,
    competencia,
    tipo,
    link,
    status: "agendada",
    agendadaPorId: s.id,
  });
  await registrarAudit({
    acao: "write",
    entidade: "reuniao",
    clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
  });
  revalidatePath("/reunioes");
  return { ok: true, message: "Reunião agendada." };
}

export async function atualizarStatusReuniao(
  id: string,
  status: "realizada" | "cancelada",
): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const [r] = await db
    .select({ clienteId: reunioes.clienteId })
    .from(reunioes)
    .where(eq(reunioes.id, id))
    .limit(1);
  if (!r) return { ok: false, error: "Reunião não encontrada." };
  const esc = escopoClientes(s);
  if (esc && !esc.includes(r.clienteId)) return { ok: false, error: "Sem acesso." };

  await db.update(reunioes).set({ status }).where(eq(reunioes.id, id));
  revalidatePath("/reunioes");
  return { ok: true };
}
