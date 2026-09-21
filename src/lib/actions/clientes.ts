"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes } from "@/db/schema";
import { requireEscritorio, somenteLeitura } from "@/lib/session";
import { registrarAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/result";

const STATUS = ["ativo", "inadimplente", "inativo"] as const;

/**
 * Cadastra um polo (cliente/tenant) manualmente — onboarding pelo ESCRITÓRIO
 * antes do SSO. Pós-SSO, o handoff do Hub provisiona por org id; aqui o id é
 * gerado localmente. Só o escritório.
 */
export async function criarCliente(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return { ok: false, error: "Informe o nome do polo." };
  const cnpj = String(formData.get("cnpj") || "").trim() || null;
  const telefone = String(formData.get("telefone") || "").trim() || null;

  const id = randomUUID();
  await db.insert(clientes).values({ id, nome: nome.slice(0, 200), cnpj, telefone });
  await registrarAudit({
    acao: "write",
    entidade: "cliente",
    entidadeId: id,
    clienteId: id,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { nome },
  });
  revalidatePath("/clientes");
  return { ok: true, message: "Polo cadastrado." };
}

/** Edita metadados do polo (nome/CNPJ/telefone/status). Só o escritório. */
export async function atualizarCliente(id: string, formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return { ok: false, error: "Nome obrigatório." };
  const cnpj = String(formData.get("cnpj") || "").trim() || null;
  const telefone = String(formData.get("telefone") || "").trim() || null;
  const status = String(formData.get("status") || "ativo");
  if (!STATUS.includes(status as (typeof STATUS)[number])) {
    return { ok: false, error: "Status inválido." };
  }

  await db
    .update(clientes)
    .set({ nome: nome.slice(0, 200), cnpj, telefone, status: status as (typeof STATUS)[number] })
    .where(eq(clientes.id, id));
  await registrarAudit({
    acao: "write",
    entidade: "cliente",
    entidadeId: id,
    clienteId: id,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { nome, status },
  });
  revalidatePath("/clientes");
  return { ok: true, message: "Polo atualizado." };
}
