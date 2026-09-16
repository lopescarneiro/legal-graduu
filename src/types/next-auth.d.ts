import type { DefaultSession } from "next-auth";

/**
 * Augmentation dos tipos do Auth.js para o Legal Graduu.
 *
 * Atores: POLO (cliente, escopado ao próprio `clienteId`) e ESCRITÓRIO (advogado
 * cross-cliente — `escritorio: true`, vê todos os clientes). `escritorio` só vem
 * verdadeiro do Hub (ou do login dev); nunca é default. Ver src/lib/session.ts.
 */
declare module "next-auth" {
  interface User {
    nome?: string | null;
    superAdmin?: boolean;
    /** Advogado do escritório (Verônica Gilioli) — opera TODOS os clientes. */
    escritorio?: boolean;
    /** Tenant do usuário POLO (id global do Hub). null para escritório/superadmin. */
    clienteId?: string | null;
    papeis?: string[];
    impersonando?: boolean;
    idGlobal?: string | null;
    claimsVersion?: number | null;
    statusAssinatura?: string | null;
    renovaEm?: string | null;
  }
  interface Session {
    user: {
      id: string;
      nome?: string | null;
      superAdmin?: boolean;
      escritorio?: boolean;
      clienteId?: string | null;
      papeis?: string[];
      impersonando?: boolean;
      revogado?: boolean;
      statusAssinatura?: string | null;
      renovaEm?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    nome?: string | null;
    superAdmin?: boolean;
    escritorio?: boolean;
    clienteId?: string | null;
    papeis?: string[];
    impersonando?: boolean;
    revogado?: boolean;
    idGlobal?: string | null;
    claimsVersion?: number | null;
    statusAssinatura?: string | null;
    renovaEm?: string | null;
    verificadoEm?: number;
  }
}

export {};
