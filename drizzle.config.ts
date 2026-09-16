import { defineConfig } from "drizzle-kit";

/**
 * Configuração de migração (drizzle-kit push).
 *
 * - Local (sem DATABASE_URL): aplica o schema no PGlite em `.pglite/`.
 * - Produção (com DATABASE_URL): aplica no PostgreSQL/Supabase.
 *
 * Uso: `npm run db:push`. Schema-first (o build NÃO aplica migração).
 * Regra de ouro da suíte: ao criar tabela `public` nova, LIGAR RLS no Supabase.
 */
const url = process.env.DATABASE_URL;

export default url
  ? defineConfig({
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dialect: "postgresql",
      dbCredentials: { url },
    })
  : defineConfig({
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dialect: "postgresql",
      driver: "pglite",
      dbCredentials: { url: process.env.PGLITE_DIR ?? "./.pglite" },
    });
