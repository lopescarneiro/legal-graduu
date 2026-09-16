import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { modelos } from "@/db/schema";

export type { TipoCampo, CampoModelo } from "./modelos-constantes";
export { TIPOS_CAMPO, CATEGORIAS, rotuloCategoria } from "./modelos-constantes";

export async function listarModelos(incluirInativos: boolean) {
  return db
    .select()
    .from(modelos)
    .where(incluirInativos ? undefined : eq(modelos.ativo, true))
    .orderBy(desc(modelos.criadoEm));
}

export async function obterModelo(id: string) {
  const [m] = await db.select().from(modelos).where(eq(modelos.id, id)).limit(1);
  return m ?? null;
}

/** Substitui {{chave}} no corpo pelos valores preenchidos. Chave sem valor → "". */
export function preencherCorpo(corpo: string, valores: Record<string, string>): string {
  return corpo.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, chave: string) => valores[chave] ?? "");
}

/** Chaves {{...}} usadas no corpo (p/ conferir cobertura pelos campos definidos). */
export function chavesNoCorpo(corpo: string): string[] {
  const set = new Set<string>();
  for (const m of corpo.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) set.add(m[1]);
  return [...set];
}
