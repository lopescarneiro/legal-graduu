import "server-only";
/**
 * Cifragem de segredos de integração em repouso — AES-256-GCM.
 *
 * Chave: `process.env.INTEGRACOES_KEY` em base64 (32 bytes = 256 bits). Gere com:
 *   openssl rand -base64 32
 *
 * Formato do blob: `${ivB64}:${cipherB64}:${tagB64}` — IV de 12 bytes (padrão GCM)
 * + texto cifrado + tag de autenticação (128 bits). O `decifrar` valida a tag
 * (integridade/autenticidade): adulteração do blob faz o `final()` lançar.
 *
 * REGRA DE OURO: o texto em claro (token/apiKey) NUNCA é logado nem devolvido ao
 * client — só o código server-only o usa para falar com o provedor.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

/** Deriva a chave de 32 bytes do env. Lança claro se ausente/inválida. */
function obterChave(): Buffer {
  const b64 = process.env.INTEGRACOES_KEY;
  if (!b64) {
    throw new Error(
      "INTEGRACOES_KEY ausente: defina uma chave base64 de 32 bytes (openssl rand -base64 32).",
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRACOES_KEY inválida: precisa ter 32 bytes (base64).");
  }
  return key;
}

/** True se a INTEGRACOES_KEY existe e é válida (usado p/ mensagens amigáveis nas ações). */
export function integracoesKeyConfigurada(): boolean {
  try {
    obterChave();
    return true;
  } catch {
    return false;
  }
}

/** Cifra um texto em claro → blob `iv:cipher:tag` (base64). */
export function cifrar(plain: string): string {
  const key = obterChave();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
}

/** Decifra um blob `iv:cipher:tag`. Lança se a chave/blob/tag não conferirem. */
export function decifrar(blob: string): string {
  const key = obterChave();
  const [ivB64, encB64, tagB64] = blob.split(":");
  if (!ivB64 || !encB64 || !tagB64) {
    throw new Error("Blob de segredo malformado (esperado iv:cipher:tag).");
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
