"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { modelos, modeloGeracoes } from "@/db/schema";
import { requireSessao, requireEscritorio, somenteLeitura } from "@/lib/session";
import { preencherCorpo } from "@/lib/modelos";
import { registrarAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/result";

const campoSchema = z.object({
  chave: z
    .string()
    .regex(/^[\w.-]+$/, "Chave inválida (use letras, números, ., - ou _)"),
  rotulo: z.string().min(1, "Rótulo obrigatório"),
  tipo: z.enum(["text", "textarea", "date", "numero", "moeda", "cpf_cnpj"]),
  obrigatorio: z.boolean(),
  ajuda: z.string().optional(),
});

const modeloSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório"),
  categoria: z.enum([
    "funcionarios",
    "fornecedores",
    "locacao",
    "lgpd",
    "societario",
    "processo",
    "outros",
  ]),
  descricao: z.string().optional(),
  corpo: z.string().min(1, "O corpo do modelo é obrigatório"),
  variaveis: z.array(campoSchema),
});

/** Cria (id=null) ou atualiza um modelo. Só o ESCRITÓRIO. */
export async function salvarModelo(id: string | null, dados: unknown): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const parsed = modeloSchema.safeParse(dados);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const chaves = parsed.data.variaveis.map((v) => v.chave);
  if (new Set(chaves).size !== chaves.length) {
    return { ok: false, error: "Há chaves de campo repetidas." };
  }

  const valores = {
    titulo: parsed.data.titulo,
    categoria: parsed.data.categoria,
    descricao: parsed.data.descricao ?? null,
    corpo: parsed.data.corpo,
    variaveis: parsed.data.variaveis,
  };

  if (id) {
    await db.update(modelos).set(valores).where(eq(modelos.id, id));
  } else {
    await db.insert(modelos).values(valores);
  }
  await registrarAudit({
    acao: "write",
    entidade: "modelo",
    entidadeId: id ?? undefined,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { titulo: valores.titulo, campos: chaves.length },
  });
  revalidatePath("/compliance/modelos");
  return { ok: true, message: "Modelo salvo." };
}

/** Liga/desliga (arquiva) um modelo. Só o ESCRITÓRIO. */
export async function alternarAtivoModelo(id: string, ativo: boolean): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  await db.update(modelos).set({ ativo }).where(eq(modelos.id, id));
  revalidatePath("/compliance/modelos");
  return { ok: true };
}

/**
 * Gera um documento a partir do modelo + valores preenchidos. Qualquer usuário
 * autenticado (o POLO). Persiste como `modelo_geracoes` cercada pelo cliente da
 * sessão (escritório → clienteId null = preview).
 */
export async function gerarDocumento(
  modeloId: string,
  valores: Record<string, string>,
): Promise<ActionResult & { conteudo?: string }> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const [m] = await db.select().from(modelos).where(eq(modelos.id, modeloId)).limit(1);
  if (!m || !m.ativo) return { ok: false, error: "Modelo indisponível." };

  for (const c of m.variaveis ?? []) {
    if (c.obrigatorio && !(valores[c.chave] ?? "").trim()) {
      return { ok: false, error: `Preencha o campo: ${c.rotulo}` };
    }
  }

  const conteudo = preencherCorpo(m.corpo, valores);
  await db.insert(modeloGeracoes).values({
    modeloId,
    clienteId: s.clienteId ?? null,
    valores,
    conteudoGerado: conteudo,
    criadoPorId: s.id,
  });
  await registrarAudit({
    acao: "write",
    entidade: "modelo_geracao",
    entidadeId: modeloId,
    clienteId: s.clienteId,
    atorId: s.id,
    atorPapel: s.escritorio ? "escritorio" : "polo",
    detalhe: { modelo: m.titulo },
  });
  revalidatePath(`/compliance/modelos/${modeloId}/preencher`);
  return { ok: true, message: "Documento gerado.", conteudo };
}
