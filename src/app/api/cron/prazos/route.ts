import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { prazos, processos, clientes } from "@/db/schema";
import { autorizarCron } from "@/lib/cron-auth";
import { enviarWhatsapp } from "@/lib/atende";
import { todayISO, formatDate, addDays, parseISO, format } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron de lembrete de prazo: prazos CONFIRMADOS a vencer em até 5 dias, ainda sem
 * lembrete, disparam WhatsApp (Atende, best-effort). Marca `lembrete_enviado_em`.
 *
 * TODO (hardening): confirmação de entrega + escalonamento (2º canal) + dead-letter +
 * heartbeat do cron (revisão E5). Por ora marca enviado mesmo em best-effort.
 */
export async function GET(req: Request) {
  const bloqueio = autorizarCron(req);
  if (bloqueio) return bloqueio;

  const hoje = todayISO();
  const limite = format(addDays(parseISO(hoje), 5), "yyyy-MM-dd");

  const pendentes = await db
    .select({
      id: prazos.id,
      dataVencimento: prazos.dataVencimento,
      descricao: prazos.descricao,
      telefone: clientes.telefone,
      numeroCnj: processos.numeroCnj,
    })
    .from(prazos)
    .innerJoin(processos, eq(processos.id, prazos.processoId))
    .leftJoin(clientes, eq(clientes.id, prazos.clienteId))
    .where(
      and(
        isNotNull(prazos.validadoEm),
        isNull(prazos.lembreteEnviadoEm),
        isNotNull(prazos.dataVencimento),
        gte(prazos.dataVencimento, hoje),
        lte(prazos.dataVencimento, limite),
        ne(prazos.status, "cumprido"),
      ),
    );

  let enviados = 0;
  let semCanal = 0;
  for (const p of pendentes) {
    const texto = `Lembrete de prazo: ${p.descricao ?? "prazo"} (processo ${p.numeroCnj ?? ""}) vence em ${formatDate(p.dataVencimento)}.`;
    // Só marca como enviado quando o envio REALMENTE ocorreu. Sem telefone/canal
    // ou em falha, o prazo NÃO é consumido — reprocessa na próxima passada
    // (nunca perder o alerta de um prazo fatal por um no-op do Atende).
    const ok = p.telefone ? await enviarWhatsapp(p.telefone, texto) : false;
    if (ok) {
      await db.update(prazos).set({ lembreteEnviadoEm: new Date() }).where(eq(prazos.id, p.id));
      enviados++;
    } else {
      semCanal++;
    }
  }

  return NextResponse.json({ ok: true, verificados: pendentes.length, enviados, pendentesReprocessar: semCanal });
}
