"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { documentos } from "@/db/schema";
import { requireSessao, somenteLeitura, ehEscritorio } from "@/lib/session";
import { guardarArquivo } from "@/lib/storage";
import { registrarAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/result";

const CATS = ["funcionarios", "fornecedores", "locacao", "lgpd", "societario", "outros"] as const;
const SIGILOS = ["normal", "sensivel", "segredo_justica"] as const;
const MAX_BYTES = 14 * 1024 * 1024;

export async function uploadDocumento(formData: FormData): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: "Selecione um arquivo." };
  }
  if (arquivo.size > MAX_BYTES) return { ok: false, error: "Arquivo acima de 14 MB." };

  const nome = String(formData.get("nome") || arquivo.name || "Documento").trim().slice(0, 200);
  const categoria = String(formData.get("categoria") || "outros");
  if (!CATS.includes(categoria as (typeof CATS)[number])) {
    return { ok: false, error: "Categoria inválida." };
  }
  const sigilo = String(formData.get("sigilo") || "normal");
  if (!SIGILOS.includes(sigilo as (typeof SIGILOS)[number])) {
    return { ok: false, error: "Sigilo inválido." };
  }
  const vencRaw = String(formData.get("vencimento") || "").trim();
  const vencimento = /^\d{4}-\d{2}-\d{2}$/.test(vencRaw) ? vencRaw : null;

  let clienteId: string | null;
  if (ehEscritorio(s)) {
    clienteId = String(formData.get("clienteId") || "").trim() || null;
    if (!clienteId) return { ok: false, error: "Selecione o cliente." };
  } else {
    clienteId = s.clienteId;
    if (!clienteId) return { ok: false, error: "Sessão sem cliente." };
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  let chave: string;
  try {
    chave = await guardarArquivo(clienteId, nome, bytes, arquivo.type);
  } catch {
    return { ok: false, error: "Falha ao guardar o arquivo." };
  }

  const [row] = await db
    .insert(documentos)
    .values({
      clienteId,
      categoria: categoria as (typeof CATS)[number],
      nome,
      arquivoPath: chave,
      mime: arquivo.type || null,
      tamanhoBytes: bytes.length,
      sigilo: sigilo as (typeof SIGILOS)[number],
      contemDadosSensiveis: sigilo !== "normal",
      vencimentoEm: vencimento,
      uploadedByTipo: ehEscritorio(s) ? "escritorio" : "polo",
      uploadedById: s.id,
      status: "nao_avaliado",
    })
    .returning({ id: documentos.id });

  await registrarAudit({
    acao: "write",
    entidade: "documento",
    entidadeId: row?.id,
    clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
    detalhe: { nome, categoria },
  });
  revalidatePath("/compliance/repositorio");
  return { ok: true, message: "Documento enviado." };
}
