import "server-only";
import { createHash } from "node:crypto";
import { asc, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

type AcaoAudit = "view" | "download" | "write" | "delete" | "login" | "export";

/** Chave fixa do advisory lock que serializa a escrita da cadeia (só em prod). */
const LOCK_CADEIA = 4771123;
const SEP = "";

type RegistroCanonico = {
  criadoEm: Date;
  clienteId: string | null;
  atorId: string | null;
  atorPapel: string | null;
  ip: string | null;
  acao: AcaoAudit;
  entidade: string;
  entidadeId: string | null;
  detalhe: Record<string, unknown> | null;
};

/** JSON estável (chaves ordenadas) — imune à reordenação de chaves do jsonb. */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  const chaves = Object.keys(o).sort();
  return `{${chaves.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

/** Serialização canônica e determinística de um evento (base do hash). */
function canonico(r: RegistroCanonico): string {
  return [
    r.criadoEm.toISOString(),
    r.clienteId ?? "",
    r.atorId ?? "",
    r.atorPapel ?? "",
    r.ip ?? "",
    r.acao,
    r.entidade,
    r.entidadeId ?? "",
    stableStringify(r.detalhe),
  ].join(SEP);
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** hash = sha256(prevHash || canonico(evento)). */
function calcularHash(prevHash: string | null, r: RegistroCanonico): string {
  return sha256((prevHash ?? "") + SEP + canonico(r));
}

/**
 * Registra um evento na trilha de auditoria com encadeamento de hash
 * (append-only tamper-evident): cada linha carrega `prev_hash` = hash da anterior
 * e `hash` = sha256(prev_hash || conteúdo canônico). Adulterar/remover uma linha
 * quebra a cadeia a partir dela (detectável por `verificarCadeiaAudit`).
 *
 * Best-effort: uma falha aqui NÃO derruba a operação de negócio. Em produção a
 * escrita é serializada por advisory lock para a cadeia não bifurcar sob
 * concorrência serverless; em dev (PGlite, conexão única) o lock é dispensável.
 */
type EntradaAudit = {
  acao: AcaoAudit;
  entidade: string;
  entidadeId?: string | null;
  clienteId?: string | null;
  atorId?: string | null;
  atorPapel?: string | null;
  ip?: string | null;
  detalhe?: Record<string, unknown>;
};

/** Grava a entrada encadeada. LANÇA em caso de falha (base das duas variantes). */
async function gravarAudit(p: EntradaAudit): Promise<void> {
  const registro: RegistroCanonico = {
    criadoEm: new Date(),
    clienteId: p.clienteId ?? null,
    atorId: p.atorId ?? null,
    atorPapel: p.atorPapel ?? null,
    ip: p.ip ?? null,
    acao: p.acao,
    entidade: p.entidade,
    entidadeId: p.entidadeId ?? null,
    detalhe: p.detalhe ?? null,
  };

  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL) {
      // Serializa os escritores da cadeia; liberado no fim da transação.
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_CADEIA})`);
    }
    const [ultimo] = await tx
      .select({ hash: auditLog.hash })
      .from(auditLog)
      .orderBy(desc(auditLog.criadoEm), desc(auditLog.id))
      .limit(1);
    const prevHash = ultimo?.hash ?? null;
    const hash = calcularHash(prevHash, registro);
    await tx.insert(auditLog).values({ ...registro, prevHash, hash });
  });
}

export async function registrarAudit(p: EntradaAudit): Promise<void> {
  try {
    await gravarAudit(p);
  } catch {
    // auditoria é best-effort — nunca falha a ação de negócio
  }
}

/**
 * Variante FAIL-CLOSED: usada em acesso a dado SIGILOSO (download de documento
 * sensível). Se a trilha não puder ser gravada, a operação NÃO deve prosseguir.
 */
export async function registrarAuditEstrito(p: EntradaAudit): Promise<void> {
  await gravarAudit(p);
}

/**
 * Reconstrói e valida a cadeia de auditoria. Ignora linhas legadas anteriores ao
 * hash-chain (hash null). Verifica, para cada linha encadeada: (a) integridade de
 * conteúdo (o hash bate com o conteúdo + prev_hash gravados) e (b) ligação em
 * ordem (prev_hash == hash da linha encadeada anterior).
 */
export async function verificarCadeiaAudit(): Promise<{
  ok: boolean;
  total: number;
  encadeadas: number;
  problema?: string;
  linhaId?: string;
}> {
  const linhas = await db
    .select()
    .from(auditLog)
    .orderBy(asc(auditLog.criadoEm), asc(auditLog.id));

  let esperadoPrev: string | null = null;
  let encadeadas = 0;
  let iniciou = false;

  for (const r of linhas) {
    if (r.hash == null) {
      // linha legada (pré hash-chain) — só permitida antes do início da cadeia
      if (iniciou) {
        return {
          ok: false,
          total: linhas.length,
          encadeadas,
          problema: "linha sem hash no meio da cadeia",
          linhaId: r.id,
        };
      }
      continue;
    }
    iniciou = true;

    const registro: RegistroCanonico = {
      criadoEm: new Date(r.criadoEm),
      clienteId: r.clienteId,
      atorId: r.atorId,
      atorPapel: r.atorPapel,
      ip: r.ip,
      acao: r.acao,
      entidade: r.entidade,
      entidadeId: r.entidadeId,
      detalhe: r.detalhe ?? null,
    };

    if (r.hash !== calcularHash(r.prevHash ?? null, registro)) {
      return {
        ok: false,
        total: linhas.length,
        encadeadas,
        problema: "conteúdo adulterado (hash não confere)",
        linhaId: r.id,
      };
    }
    if ((r.prevHash ?? null) !== esperadoPrev) {
      return {
        ok: false,
        total: linhas.length,
        encadeadas,
        problema: "cadeia quebrada (linha inserida ou removida)",
        linhaId: r.id,
      };
    }
    esperadoPrev = r.hash;
    encadeadas += 1;
  }

  return { ok: true, total: linhas.length, encadeadas };
}
