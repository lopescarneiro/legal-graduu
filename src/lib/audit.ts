import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

type AcaoAudit = "view" | "download" | "write" | "delete" | "login" | "export";

/**
 * Registra um evento na trilha de auditoria. Best-effort: uma falha aqui NÃO derruba
 * a operação de negócio.
 *
 * TODO (hardening pré-produção): imutabilidade real — encadeamento de hash
 * (`hash = sha256(prevHash || payload)`) e tabela append-only no Supabase (sem GRANT
 * de UPDATE/DELETE ao role do app). Por ora grava o evento sem o hash-chain.
 */
export async function registrarAudit(p: {
  acao: AcaoAudit;
  entidade: string;
  entidadeId?: string | null;
  clienteId?: string | null;
  atorId?: string | null;
  atorPapel?: string | null;
  ip?: string | null;
  detalhe?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      acao: p.acao,
      entidade: p.entidade,
      entidadeId: p.entidadeId ?? null,
      clienteId: p.clienteId ?? null,
      atorId: p.atorId ?? null,
      atorPapel: p.atorPapel ?? null,
      ip: p.ip ?? null,
      detalhe: p.detalhe ?? null,
    });
  } catch {
    // auditoria é best-effort — nunca falha a ação de negócio
  }
}
