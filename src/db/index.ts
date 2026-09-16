import { drizzle as pgliteDrizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as postgresDrizzle } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Cliente de banco único para todo o app, com inicialização PREGUIÇOSA
 * (só conecta no primeiro uso — evita abrir o PGlite à toa durante o build).
 *
 * - Sem `DATABASE_URL` (desenvolvimento): usa PGlite — um PostgreSQL real
 *   rodando em processo, persistido na pasta `.pglite/`. Zero instalação.
 * - Com `DATABASE_URL` (produção, ex.: Supabase): usa postgres.js.
 *
 * O dialeto é PostgreSQL nos dois casos, então a aplicação é idêntica.
 */
type Database = PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __pglite?: PGlite;
  __db?: Database;
};

function createDb(): Database {
  const url = process.env.DATABASE_URL;

  if (url) {
    // Serverless (Vercel): 1 conexão por instância + libera a ociosa rápido. O default
    // max:10 estoura o limite de conexões do Postgres sob concorrência (EMAXCONN).
    // Força o pooler de TRANSAÇÃO (:6543) quando a URL veio em session mode (:5432).
    const conn =
      url.includes("pooler.supabase.com") && url.includes(":5432")
        ? url.replace(":5432", ":6543")
        : url;
    const client = postgres(conn, { prepare: false, ssl: "require", max: 1, idle_timeout: 20, connect_timeout: 15 });
    // A API é idêntica entre os drivers; tipamos como PgliteDatabase para um único tipo.
    return postgresDrizzle(client, { schema }) as unknown as Database;
  }

  const dataDir = process.env.PGLITE_DIR ?? "./.pglite";
  const pglite = globalForDb.__pglite ?? new PGlite(dataDir);
  globalForDb.__pglite = pglite;
  return pgliteDrizzle(pglite, { schema });
}

function getDb(): Database {
  if (!globalForDb.__db) {
    globalForDb.__db = createDb();
  }
  return globalForDb.__db;
}

/** Instância do banco (proxy preguiçoso: conecta no primeiro acesso). */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** Fecha a conexão PGlite (usado por scripts como o seed para gravar e sair). */
export async function closeDb(): Promise<void> {
  if (globalForDb.__pglite) {
    await globalForDb.__pglite.close();
    globalForDb.__pglite = undefined;
    globalForDb.__db = undefined;
  }
}

export { schema };
