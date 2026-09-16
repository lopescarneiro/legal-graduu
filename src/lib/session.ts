import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Sessão do Legal Graduu. Dois tipos de ator:
 *  - POLO (cliente): escopado ao próprio `clienteId` (tenant, id global do Hub).
 *  - ESCRITÓRIO (advogado): `escritorio: true` → opera TODOS os clientes (cross-tenant).
 *
 * A cerca multi-tenant usa `escopoClientes()`: null = sem restrição (escritório/
 * superadmin), array = só esses clientes, **vazio = NADA** (fail-closed). Escopo
 * vazio NUNCA vira "vê tudo" — é o erro que a cerca da suíte foi feita para evitar.
 */
export type Sessao = {
  id: string;
  clienteId: string | null;
  nome: string | null;
  email: string | null;
  superAdmin: boolean;
  escritorio: boolean;
  papeis: string[];
  impersonando: boolean;
  statusAssinatura: string | null;
  renovaEm: string | null;
};

/** Advogado do escritório (ou superadmin): visão cross-cliente. */
export function ehEscritorio(s: Sessao): boolean {
  return s.escritorio || s.superAdmin;
}

/** Usuário do polo (cliente): visão restrita ao próprio tenant. */
export function ehPolo(s: Sessao): boolean {
  return !ehEscritorio(s);
}

/** Sessão "Ver como" (impersonação) → toda escrita deve ser bloqueada. */
export function somenteLeitura(s: Sessao): boolean {
  return s.impersonando;
}

/**
 * Escopo de clientes para cercar TODA query. null = sem restrição (escritório vê
 * tudo); array = só esses; **[] = fail-closed (nada)**. Use como:
 *   const esc = escopoClientes(s);
 *   if (esc && esc.length === 0) return [];               // nada a ver
 *   const cerca = esc ? inArray(t.clienteId, esc) : undefined;  // undefined = sem restrição
 */
export function escopoClientes(s: Sessao): string[] | null {
  if (ehEscritorio(s)) return null;
  return s.clienteId ? [s.clienteId] : [];
}

/** Sessão do usuário logado ou null. */
export async function getSessao(): Promise<Sessao | null> {
  const s = await auth();
  if (!s?.user?.id) return null;
  return {
    id: s.user.id,
    clienteId: s.user.clienteId ?? null,
    nome: s.user.nome ?? s.user.name ?? null,
    email: s.user.email ?? null,
    superAdmin: s.user.superAdmin ?? false,
    escritorio: s.user.escritorio ?? false,
    papeis: s.user.papeis ?? [],
    impersonando: s.user.impersonando ?? false,
    statusAssinatura: s.user.statusAssinatura ?? null,
    renovaEm: s.user.renovaEm ?? null,
  };
}

/** Exige sessão; redireciona para /login se ausente. */
export async function requireSessao(): Promise<Sessao> {
  const s = await getSessao();
  if (!s) redirect("/login");
  return s;
}

/** Exige um advogado do escritório (ou superadmin); senão manda pra home. */
export async function requireEscritorio(): Promise<Sessao> {
  const s = await requireSessao();
  if (!ehEscritorio(s)) redirect("/");
  return s;
}
