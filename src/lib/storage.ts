import "server-only";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

/**
 * Storage de arquivos (bucket PRIVADO). Em produção usa o Supabase Storage (REST,
 * sem SDK extra); em dev, sem as envs, grava em disco local `.storage/` (gitignored).
 *
 * REGRA: o download SEMPRE passa pela nossa rota autenticada (/api/documentos/[id]),
 * que cerca por cliente + sigilo e audita — nunca expomos o arquivo direto.
 */
function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_PRIVADO;
  if (url && key && bucket) return { url: url.replace(/\/$/, ""), key, bucket };
  return null;
}

export function storageConfigurado(): boolean {
  return !!supabaseCfg();
}

function extDe(nome: string): string {
  const e = path.extname(nome || "");
  return e && e.length <= 10 ? e.toLowerCase() : "";
}

function baseLocal(): string {
  return path.join(process.cwd(), ".storage");
}

/** Guarda os bytes e retorna a CHAVE (grava em documentos.arquivoPath). */
export async function guardarArquivo(
  escopo: string,
  nomeArquivo: string,
  bytes: Buffer,
  mime: string,
): Promise<string> {
  const chave = `${escopo}/${randomUUID()}${extDe(nomeArquivo)}`;
  const cfg = supabaseCfg();
  if (cfg) {
    const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${chave}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.key}`,
        "content-type": mime || "application/octet-stream",
        "x-upsert": "true",
      },
      body: new Uint8Array(bytes),
    });
    if (!res.ok) throw new Error(`storage upload falhou (${res.status})`);
    return chave;
  }
  const abs = path.join(baseLocal(), chave);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, bytes);
  return chave;
}

/** Lê os bytes pela chave. Rejeita chaves com traversal. */
export async function lerArquivo(chave: string): Promise<Buffer> {
  if (chave.includes("..")) throw new Error("chave inválida");
  const cfg = supabaseCfg();
  if (cfg) {
    const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${chave}`, {
      headers: { authorization: `Bearer ${cfg.key}` },
    });
    if (!res.ok) throw new Error(`storage download falhou (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  const abs = path.join(baseLocal(), chave);
  return fs.readFile(abs);
}
