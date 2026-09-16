import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { clientes } from "@/db/schema";

/** Lista de clientes (id + nome) — usada nos seletores do escritório. */
export async function listarClientes() {
  return db.select({ id: clientes.id, nome: clientes.nome }).from(clientes).orderBy(asc(clientes.nome));
}
