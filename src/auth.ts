import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/db";
import { clientes } from "@/db/schema";
import { authConfig } from "./auth.config";

/**
 * Auth.js do Legal Graduu. Dois providers:
 *
 * 1. `hub` — SSO central da suíte (handoff). DORMENTE até `HUB_URL` +
 *    `HUB_APP_SECRET` no ambiente E o app "legal" registrado no Hub (apps/AppId).
 *    Banco próprio → confia na identidade do /api/handoff/exchange (sem lookup local).
 *    ⚠️ O claim `escritorio` depende de uma extensão do Hub (ator escritório, espelhando
 *    `adminOrg`) ainda pendente — até lá, usuários do Hub entram como POLO.
 *
 * 2. `dev` — login de desenvolvimento, só com `LEGAL_DEV_LOGIN=1` (nunca em produção).
 *    Entra como ADVOGADO DO ESCRITÓRIO (cross-cliente) para exercitar a ACL localmente.
 */

const DEV_UUID = "00000000-0000-4000-8000-000000000001";

type Vinculo = { poloGlobalId?: string; papelOrg?: string; papelNativo?: string };
type ExchangeResp = {
  ok?: boolean;
  usuario?: {
    idGlobal?: string;
    email?: string;
    nome?: string;
    superAdmin?: boolean;
    adminOrg?: boolean;
    /** Extensão pendente do Hub: advogado do escritório (cross-cliente). */
    escritorio?: boolean;
    orgId?: string | null;
    claimsVersion?: number;
    statusAssinatura?: string | null;
    renovaEm?: string | null;
  };
  vinculos?: Vinculo[];
  impersonadoPor?: string | null;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "hub",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(cred) {
        const raw = typeof cred?.token === "string" ? cred.token : "";
        const base = process.env.HUB_URL;
        const segredo = process.env.HUB_APP_SECRET;
        if (!raw || !base || !segredo) return null;

        let data: ExchangeResp | null = null;
        try {
          const res = await fetch(`${base.replace(/\/$/, "")}/api/handoff/exchange`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-app-secret": segredo },
            body: JSON.stringify({ slug: "legal", token: raw }),
          });
          if (!res.ok) return null;
          data = (await res.json()) as ExchangeResp;
        } catch {
          return null;
        }
        if (!data?.ok || !data.usuario?.idGlobal) return null;

        const vinc = Array.isArray(data.vinculos) ? data.vinculos : [];
        const papeis = [...new Set(vinc.map((v) => v.papelOrg).filter((x): x is string => !!x))];

        // POLO (cliente): tenant = a org do Hub. Escritório/superadmin: null (cross-cliente).
        const clienteId =
          data.usuario.escritorio || data.usuario.superAdmin
            ? null
            : (data.usuario.orgId ?? null);

        // Provisiona o polo como cliente/tenant na 1ª entrada (best-effort; o
        // escritório ajusta nome/telefone na tela de Clientes). onConflictDoNothing
        // preserva um cadastro já existente.
        if (clienteId) {
          try {
            await db
              .insert(clientes)
              .values({ id: clienteId, nome: "Polo (defina o nome)" })
              .onConflictDoNothing();
          } catch {
            // provisionamento não bloqueia o login
          }
        }

        return {
          id: data.usuario.idGlobal,
          email: data.usuario.email ?? "",
          name: data.usuario.nome ?? null,
          nome: data.usuario.nome ?? null,
          superAdmin: !!data.usuario.superAdmin,
          escritorio: !!data.usuario.escritorio,
          clienteId,
          papeis,
          impersonando: !!data.impersonadoPor,
          idGlobal: data.usuario.idGlobal,
          claimsVersion: data.usuario.claimsVersion ?? 0,
          statusAssinatura: data.usuario.statusAssinatura ?? null,
          renovaEm: data.usuario.renovaEm ?? null,
        };
      },
    }),
    Credentials({
      id: "dev",
      credentials: { email: { label: "E-mail" }, senha: { label: "Senha" } },
      async authorize(cred) {
        // FAIL-CLOSED: jamais em produção, mesmo que a flag vaze pro ambiente.
        if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
          return null;
        }
        if (process.env.LEGAL_DEV_LOGIN !== "1") return null;
        const esperada = process.env.LEGAL_DEV_PASSWORD;
        if (!esperada) return null;
        const parsed = z
          .object({ email: z.string().email(), senha: z.string().min(1) })
          .safeParse(cred);
        if (!parsed.success) return null;
        if (parsed.data.senha !== esperada) return null;
        return {
          id: DEV_UUID,
          email: parsed.data.email,
          name: "Dev (Escritório)",
          nome: "Dev (Escritório)",
          superAdmin: false,
          escritorio: true, // advogado do escritório: cross-cliente
          clienteId: null,
          papeis: ["advogado"],
          impersonando: false,
        };
      },
    }),
    Credentials({
      id: "preview",
      credentials: { email: { label: "E-mail" }, senha: { label: "Senha" } },
      async authorize(cred) {
        // PREVIEW PRIVADO: funciona em produção MAS só atrás da proteção da Vercel
        // (Vercel Authentication = só o time). Exige LEGAL_PREVIEW_LOGIN=on + senha
        // forte. Temporário até o SSO do Hub ser fiado — depois removemos.
        if (process.env.LEGAL_PREVIEW_LOGIN !== "on") return null;
        const esperada = process.env.LEGAL_PREVIEW_PASSWORD;
        if (!esperada) return null;
        const parsed = z
          .object({ email: z.string().email(), senha: z.string().min(1) })
          .safeParse(cred);
        if (!parsed.success) return null;
        if (parsed.data.senha !== esperada) return null;
        return {
          id: DEV_UUID,
          email: parsed.data.email,
          name: "Escritório (preview)",
          nome: "Escritório (preview)",
          superAdmin: false,
          escritorio: true,
          clienteId: null,
          papeis: ["advogado"],
          impersonando: false,
        };
      },
    }),
  ],
});
