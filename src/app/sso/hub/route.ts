import { NextResponse } from "next/server";
import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * Landing do SSO da suíte: o Hub redireciona para cá com `?token=<authz_code>&next=`.
 * Trocamos o token pelas claims (provider `hub` → /api/handoff/exchange) e criamos a
 * sessão local. DORMENTE até o app "legal" estar registrado no Hub. Ver src/auth.ts.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const next = url.searchParams.get("next") || "/";
  if (!token) return NextResponse.redirect(new URL("/login?erro=sso", url));
  try {
    await signIn("hub", { token, redirect: false });
  } catch {
    return NextResponse.redirect(new URL("/login?erro=sso", url));
  }
  // `next` precisa ser um caminho relativo same-origin. Rejeita "//host" e "/\host"
  // (que new URL resolveria para host externo) — evita open-redirect.
  const relativoSeguro =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");
  const destino = relativoSeguro ? next : "/";
  return NextResponse.redirect(new URL(destino, url));
}
