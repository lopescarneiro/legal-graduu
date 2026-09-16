import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { checarManutencao } from "@/lib/manutencao";

// Proxy de proteção de rotas (Edge; ex-"middleware", renomeado no Next 16). Checa a
// MANUTENÇÃO antes do auth; fora dela, delega ao NextAuth (authorized). FAIL-OPEN.
const proteger = NextAuth(authConfig).auth as unknown as (
  req: NextRequest,
  ev: NextFetchEvent,
) => Promise<Response | undefined>;

export default async function proxy(req: NextRequest, ev: NextFetchEvent) {
  if (!req.nextUrl.pathname.startsWith("/manutencao")) {
    const m = await checarManutencao();
    if (m?.ativo) {
      return NextResponse.rewrite(new URL("/manutencao", req.url));
    }
  }
  return proteger(req, ev);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
