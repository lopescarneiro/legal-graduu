import type { NextAuthConfig } from "next-auth";

/**
 * Configuração base do Auth.js — segura para rodar no Edge (middleware/proxy).
 * NÃO importa banco nem bcrypt aqui. Os providers (que falam com o Hub) são
 * adicionados em `auth.ts`, usados apenas no runtime Node.
 */
const REVALIDA_MS = 5 * 60 * 1000; // revalida a sessão contra o Hub no máx. a cada 5 min

/**
 * Revalida a sessão contra o Hub (/api/handoff/verify). true = REVOGADA (usuário
 * inativo / claims_version mudou), false = válida, null = indeterminado (Hub fora /
 * sem env → FAIL-OPEN, não derruba ninguém por soluço de rede).
 */
async function sessaoRevogada(
  idGlobal: string,
  claimsVersion: number | null,
): Promise<boolean | null> {
  const base = process.env.HUB_URL;
  const segredo = process.env.HUB_APP_SECRET;
  if (!base || !segredo) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/handoff/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-secret": segredo },
      body: JSON.stringify({ slug: "legal", idGlobal, claimsVersion }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { ok?: boolean; valido?: boolean };
    if (!j?.ok) return null;
    return j.valido === false;
  } catch {
    return null;
  }
}

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const logado = !!auth?.user;
      const p = nextUrl.pathname;

      // Rotas públicas (auth + landing do SSO).
      const publicas = ["/login", "/sair", "/sso", "/manutencao"];
      if (publicas.some((r) => p === r || p.startsWith(`${r}/`))) {
        // Quem já está logado e cai no /login vai pra home.
        if (logado && p.startsWith("/login")) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (!logado) return false;

      // Sessão REVOGADA (trial vencido / org suspensa): manda pro login com aviso.
      if (auth?.user?.revogado === true) {
        return Response.redirect(new URL("/login?suspenso=1", nextUrl));
      }

      // "Ver como" (impersonação) = SOMENTE LEITURA: bloqueia mutações (não-GET).
      const imp = auth?.user?.impersonando === true;
      if (imp && request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Somente leitura (ver como).", { status: 403 });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nome = user.nome ?? user.name;
        token.superAdmin = user.superAdmin ?? false;
        token.escritorio = user.escritorio ?? false;
        token.clienteId = user.clienteId ?? null;
        token.papeis = user.papeis ?? [];
        token.impersonando = user.impersonando ?? false;
        token.idGlobal = user.idGlobal ?? null;
        token.claimsVersion = user.claimsVersion ?? null;
        token.statusAssinatura = user.statusAssinatura ?? null;
        token.renovaEm = user.renovaEm ?? null;
        token.verificadoEm = Date.now();
        token.revogado = false;
      } else if (
        token.idGlobal &&
        token.revogado !== true &&
        Date.now() - ((token.verificadoEm as number | undefined) ?? 0) > REVALIDA_MS
      ) {
        // Só sessões do Hub (têm idGlobal) revalidam. Login dev não tem → pula.
        const rev = await sessaoRevogada(
          token.idGlobal as string,
          (token.claimsVersion as number | null) ?? null,
        );
        if (rev === true) token.revogado = true;
        else if (rev === false) token.verificadoEm = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? session.user.id;
        session.user.nome = (token.nome as string | null | undefined) ?? null;
        session.user.superAdmin = (token.superAdmin as boolean | undefined) ?? false;
        session.user.escritorio = (token.escritorio as boolean | undefined) ?? false;
        session.user.clienteId = (token.clienteId as string | null | undefined) ?? null;
        session.user.papeis = (token.papeis as string[] | undefined) ?? [];
        session.user.impersonando = (token.impersonando as boolean | undefined) ?? false;
        session.user.revogado = (token.revogado as boolean | undefined) ?? false;
        session.user.statusAssinatura =
          (token.statusAssinatura as string | null | undefined) ?? null;
        session.user.renovaEm = (token.renovaEm as string | null | undefined) ?? null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
