"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { documentos, documentoAvaliacoes, processos } from "@/db/schema";
import { requireSessao, somenteLeitura, ehEscritorio, escopoClientes } from "@/lib/session";
import { guardarArquivo, lerArquivo } from "@/lib/storage";
import { iaConfigurada, avaliarDocumento, type AvaliacaoDocumento } from "@/lib/ia";
import { registrarAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/result";

const CATS = ["funcionarios", "fornecedores", "locacao", "lgpd", "societario", "outros"] as const;
const SIGILOS = ["normal", "sensivel", "segredo_justica"] as const;
const MAX_BYTES = 15 * 1024 * 1024; // abaixo do teto de framework (20mb) com folga de multipart

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

  // Versionamento: se veio "substituiId", a nova versão sucede a anterior.
  const substituiId = String(formData.get("substituiId") || "").trim() || null;
  let versao = 1;
  if (substituiId) {
    const [prev] = await db
      .select({ versao: documentos.versao, clienteId: documentos.clienteId })
      .from(documentos)
      .where(eq(documentos.id, substituiId))
      .limit(1);
    if (!prev || prev.clienteId !== clienteId) {
      return { ok: false, error: "Documento a substituir não encontrado." };
    }
    versao = (prev.versao ?? 1) + 1;
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
      versao,
      sigilo: sigilo as (typeof SIGILOS)[number],
      contemDadosSensiveis: sigilo !== "normal",
      vencimentoEm: vencimento,
      uploadedByTipo: ehEscritorio(s) ? "escritorio" : "polo",
      uploadedById: s.id,
      status: "nao_avaliado",
    })
    .returning({ id: documentos.id });

  // Marca a versão anterior como substituída (sai da listagem; vira histórico).
  if (substituiId && row?.id) {
    await db.update(documentos).set({ substituidoPorId: row.id }).where(eq(documentos.id, substituiId));
  }

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

const TIPOS_PECA = [
  "citacao",
  "contestacao",
  "recurso",
  "laudo",
  "sentenca",
  "prova",
  "outro",
] as const;

/** Anexa uma peça a um processo (categoria "processo" + tipoPeca). Só o escritório. */
export async function anexarPeca(formData: FormData): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  if (!ehEscritorio(s)) return { ok: false, error: "Apenas o escritório anexa peças." };

  const processoId = String(formData.get("processoId") || "").trim();
  const [proc] = await db
    .select({ clienteId: processos.clienteId })
    .from(processos)
    .where(eq(processos.id, processoId))
    .limit(1);
  if (!proc) return { ok: false, error: "Processo não encontrado." };
  const esc = escopoClientes(s);
  if (esc && !esc.includes(proc.clienteId)) return { ok: false, error: "Sem acesso." };

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: "Selecione o arquivo da peça." };
  }
  if (arquivo.size > MAX_BYTES) return { ok: false, error: "Arquivo acima de 15 MB." };
  const tipoPeca = String(formData.get("tipoPeca") || "outro");
  if (!TIPOS_PECA.includes(tipoPeca as (typeof TIPOS_PECA)[number])) {
    return { ok: false, error: "Tipo de peça inválido." };
  }
  const nome = String(formData.get("nome") || arquivo.name || "Peça").trim().slice(0, 200);

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  let chave: string;
  try {
    chave = await guardarArquivo(proc.clienteId, nome, bytes, arquivo.type);
  } catch {
    return { ok: false, error: "Falha ao guardar o arquivo." };
  }
  const [row] = await db
    .insert(documentos)
    .values({
      clienteId: proc.clienteId,
      processoId,
      categoria: "processo",
      tipoPeca,
      nome,
      arquivoPath: chave,
      mime: arquivo.type || null,
      tamanhoBytes: bytes.length,
      uploadedByTipo: "escritorio",
      uploadedById: s.id,
      status: "nao_avaliado",
    })
    .returning({ id: documentos.id });
  await registrarAudit({
    acao: "write",
    entidade: "peca",
    entidadeId: row?.id,
    clienteId: proc.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { tipoPeca, processoId },
  });
  revalidatePath(`/processos/${processoId}`);
  return { ok: true, message: "Peça anexada." };
}

/** Sobe uma NOVA VERSÃO de um documento (herda metadados; supersede a anterior). */
export async function substituirDocumento(formData: FormData): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const id = String(formData.get("documentoId") || "").trim();
  const esc = escopoClientes(s);
  if (esc && esc.length === 0) return { ok: false, error: "Sem acesso." };
  const [prev] = await db
    .select()
    .from(documentos)
    .where(and(eq(documentos.id, id), esc ? inArray(documentos.clienteId, esc) : undefined))
    .limit(1);
  if (!prev) return { ok: false, error: "Documento não encontrado." };

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: "Selecione o arquivo da nova versão." };
  }
  if (arquivo.size > MAX_BYTES) return { ok: false, error: "Arquivo acima de 15 MB." };

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  let chave: string;
  try {
    chave = await guardarArquivo(prev.clienteId, prev.nome, bytes, arquivo.type);
  } catch {
    return { ok: false, error: "Falha ao guardar o arquivo." };
  }
  const novaVersao = (prev.versao ?? 1) + 1;
  const [row] = await db
    .insert(documentos)
    .values({
      clienteId: prev.clienteId,
      processoId: prev.processoId,
      categoria: prev.categoria,
      tipoPeca: prev.tipoPeca,
      nome: prev.nome,
      arquivoPath: chave,
      mime: arquivo.type || null,
      tamanhoBytes: bytes.length,
      versao: novaVersao,
      sigilo: prev.sigilo,
      contemDadosSensiveis: prev.contemDadosSensiveis,
      vencimentoEm: prev.vencimentoEm,
      uploadedByTipo: ehEscritorio(s) ? "escritorio" : "polo",
      uploadedById: s.id,
      status: "nao_avaliado",
    })
    .returning({ id: documentos.id });
  if (row?.id) {
    await db.update(documentos).set({ substituidoPorId: row.id }).where(eq(documentos.id, id));
  }
  await registrarAudit({
    acao: "write",
    entidade: "documento_versao",
    entidadeId: row?.id,
    clienteId: prev.clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
    detalhe: { versao: novaVersao, substituiu: id },
  });
  revalidatePath("/compliance/repositorio");
  return { ok: true, message: `Nova versão (v${novaVersao}) enviada.` };
}

const STATUS_DOC = ["em_dia", "a_vencer", "pendente", "nao_avaliado"] as const;

/** Validação HUMANA da conformidade do documento (só o escritório carimba). */
export async function validarDocumento(id: string, status: string): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  if (!ehEscritorio(s)) return { ok: false, error: "Apenas o escritório valida a conformidade." };
  if (!STATUS_DOC.includes(status as (typeof STATUS_DOC)[number])) {
    return { ok: false, error: "Status inválido." };
  }
  const esc = escopoClientes(s);
  if (esc && esc.length === 0) return { ok: false, error: "Sem acesso." };
  const [d] = await db
    .select({ clienteId: documentos.clienteId })
    .from(documentos)
    .where(and(eq(documentos.id, id), esc ? inArray(documentos.clienteId, esc) : undefined))
    .limit(1);
  if (!d) return { ok: false, error: "Documento não encontrado." };

  await db
    .update(documentos)
    .set({ status: status as (typeof STATUS_DOC)[number], atualizadoEm: new Date() })
    .where(eq(documentos.id, id));
  await registrarAudit({
    acao: "write",
    entidade: "documento_validacao",
    entidadeId: id,
    clienteId: d.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { status },
  });
  revalidatePath("/compliance/repositorio");
  return { ok: true, message: "Conformidade atualizada." };
}

/** Renomeia um documento (dono do escopo). */
export async function renomearDocumento(id: string, nome: string): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const nomeT = nome.trim();
  if (!nomeT) return { ok: false, error: "Informe um nome." };
  const esc = escopoClientes(s);
  if (esc && esc.length === 0) return { ok: false, error: "Sem acesso." };
  const [d] = await db
    .select({ clienteId: documentos.clienteId })
    .from(documentos)
    .where(and(eq(documentos.id, id), esc ? inArray(documentos.clienteId, esc) : undefined))
    .limit(1);
  if (!d) return { ok: false, error: "Documento não encontrado." };

  await db
    .update(documentos)
    .set({ nome: nomeT.slice(0, 200), atualizadoEm: new Date() })
    .where(eq(documentos.id, id));
  await registrarAudit({
    acao: "write",
    entidade: "documento",
    entidadeId: id,
    clienteId: d.clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
    detalhe: { renomeado: nomeT },
  });
  revalidatePath("/compliance/repositorio");
  return { ok: true, message: "Documento renomeado." };
}

/** Arquiva (soft-delete) um documento — sai das listagens, preserva a trilha. */
export async function excluirDocumento(id: string): Promise<ActionResult> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const esc = escopoClientes(s);
  if (esc && esc.length === 0) return { ok: false, error: "Sem acesso." };
  const [d] = await db
    .select({ clienteId: documentos.clienteId })
    .from(documentos)
    .where(and(eq(documentos.id, id), esc ? inArray(documentos.clienteId, esc) : undefined))
    .limit(1);
  if (!d) return { ok: false, error: "Documento não encontrado." };

  await db.update(documentos).set({ arquivadoEm: new Date() }).where(eq(documentos.id, id));
  await registrarAudit({
    acao: "delete",
    entidade: "documento",
    entidadeId: id,
    clienteId: d.clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
  });
  revalidatePath("/compliance/repositorio");
  return { ok: true, message: "Documento arquivado." };
}

/**
 * Avaliação ADVISORY de um documento por IA. Barra documento sigiloso/sensível
 * (LGPD art. 33 — sem transferência internacional de dado sob sigilo). Nunca
 * carimba "em dia"; só registra pendências/riscos e sinaliza "pendente" quando
 * há apontamentos. A validação de conformidade continua humana.
 */
export async function avaliarDocumentoIA(
  documentoId: string,
): Promise<ActionResult & { avaliacao?: AvaliacaoDocumento }> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  // A avaliação por IA (parecer/score de triagem) é INTERNA do escritório — o polo
  // nunca dispara nem vê (OAB L1). Defesa em profundidade: a UI também esconde.
  if (!ehEscritorio(s)) return { ok: false, error: "Apenas o escritório avalia com IA." };
  if (!iaConfigurada()) return { ok: false, error: "Avaliação por IA indisponível." };

  const esc = escopoClientes(s);
  if (esc && esc.length === 0) return { ok: false, error: "Sem acesso." };
  const [d] = await db
    .select()
    .from(documentos)
    .where(
      and(eq(documentos.id, documentoId), esc ? inArray(documentos.clienteId, esc) : undefined),
    )
    .limit(1);
  if (!d) return { ok: false, error: "Documento não encontrado." };

  // Barreira LGPD/sigilo — documento sensível NÃO vai para o pipeline de IA.
  if (d.sigilo !== "normal" || d.contemDadosSensiveis) {
    return {
      ok: false,
      error: "Documento sigiloso/sensível não pode ir para a IA (sigilo + LGPD art. 33).",
    };
  }
  if (!d.arquivoPath) return { ok: false, error: "Documento sem arquivo." };
  const mime = d.mime ?? "";
  if (mime !== "application/pdf" && !mime.startsWith("image/")) {
    return { ok: false, error: "A IA avalia apenas PDF ou imagem. Converta para PDF." };
  }

  let bytes: Buffer;
  try {
    bytes = await lerArquivo(d.arquivoPath);
  } catch {
    return { ok: false, error: "Falha ao ler o arquivo." };
  }

  let av: AvaliacaoDocumento;
  try {
    av = await avaliarDocumento({ bytes, mime, nome: d.nome, categoria: d.categoria });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha na avaliação por IA." };
  }

  await db.insert(documentoAvaliacoes).values({
    documentoId,
    clienteId: d.clienteId,
    resumo: av.resumo,
    pendencias: av.pendencias,
    riscos: av.riscos,
    score: av.score,
    status: "revisar", // advisory — sempre requer validação humana
  });
  // Nunca "em_dia" automático. Só sinaliza pendência quando há apontamentos.
  const temIssue = av.pendencias.length > 0 || av.riscos.length > 0;
  if (temIssue && d.status !== "pendente") {
    await db
      .update(documentos)
      .set({ status: "pendente", atualizadoEm: new Date() })
      .where(eq(documentos.id, documentoId));
  }
  await registrarAudit({
    acao: "write",
    entidade: "documento_avaliacao",
    entidadeId: documentoId,
    clienteId: d.clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
    detalhe: { score: av.score, pendencias: av.pendencias.length, riscos: av.riscos.length },
  });
  revalidatePath("/compliance/repositorio");
  return { ok: true, avaliacao: av };
}
