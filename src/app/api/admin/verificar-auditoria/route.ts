import { NextResponse, type NextRequest } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { getSessao } from "@/lib/session";
import { verificarCadeiaAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifica a integridade do hash-chain da auditoria. Autoriza por CRON_SECRET
 * (Vercel Cron, heartbeat diário) OU por sessão superadmin. Responde 500 quando
 * a cadeia está quebrada (aparece no log/monitoramento).
 */
export async function GET(req: NextRequest) {
  const cronErro = autorizarCron(req);
  let autorizado = cronErro === null;
  if (!autorizado) {
    const s = await getSessao();
    autorizado = !!s?.superAdmin;
  }
  if (!autorizado) return new NextResponse("não autorizado", { status: 401 });

  const r = await verificarCadeiaAudit();
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
