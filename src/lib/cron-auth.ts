import "server-only";
import { NextResponse } from "next/server";

/**
 * Autoriza um endpoint de cron — FAIL-CLOSED.
 *
 * Exige `CRON_SECRET` setado E o header `Authorization: Bearer <CRON_SECRET>`
 * (injetado pelo Vercel Cron quando a env se chama CRON_SECRET). Retorna uma
 * resposta de erro para cortar o request, ou `null` se autorizado.
 */
export function autorizarCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "cron_nao_configurado" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "nao_autorizado" }, { status: 401 });
  }
  return null;
}
