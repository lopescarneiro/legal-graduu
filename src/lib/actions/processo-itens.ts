"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { processos, andamentos, audiencias, partes, provisoes, tarefas } from "@/db/schema";
import { requireEscritorio, somenteLeitura, escopoClientes } from "@/lib/session";
import { todayISO, saoPauloParaUTC } from "@/lib/dates";
import { parseBRLToCents } from "@/lib/money";
import { registrarAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/result";

const TIPOS_AUDIENCIA = ["conciliacao", "una", "instrucao", "outra"] as const;
const MODALIDADES = ["presencial", "virtual"] as const;
const CLASSIF_PROVISAO = ["provavel", "possivel", "remoto"] as const;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

async function processoDoEscopo(
  processoId: string,
  esc: string[] | null,
): Promise<{ clienteId: string } | null> {
  const [p] = await db
    .select({ clienteId: processos.clienteId })
    .from(processos)
    .where(eq(processos.id, processoId))
    .limit(1);
  if (!p) return null;
  if (esc && !esc.includes(p.clienteId)) return null;
  return p;
}

export async function registrarAndamento(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const processoId = String(formData.get("processoId") || "").trim();
  const p = await processoDoEscopo(processoId, escopoClientes(s));
  if (!p) return { ok: false, error: "Processo não encontrado." };

  const dataRaw = String(formData.get("data") || "").trim();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dataRaw) ? dataRaw : todayISO();
  const descricao = String(formData.get("descricao") || "").trim();
  if (!descricao) return { ok: false, error: "Descreva o andamento." };

  await db.insert(andamentos).values({ processoId, clienteId: p.clienteId, data, descricao, origem: "manual" });
  await registrarAudit({ acao: "write", entidade: "andamento", clienteId: p.clienteId, atorId: s.id, atorPapel: "escritorio" });
  revalidatePath(`/processos/${processoId}`);
  return { ok: true, message: "Andamento registrado." };
}

export async function registrarAudiencia(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const processoId = String(formData.get("processoId") || "").trim();
  const p = await processoDoEscopo(processoId, escopoClientes(s));
  if (!p) return { ok: false, error: "Processo não encontrado." };

  const dataHoraRaw = String(formData.get("dataHora") || "").trim();
  const dt = saoPauloParaUTC(dataHoraRaw); // datetime-local interpretado como Brasília
  if (!dt) return { ok: false, error: "Informe data e hora." };
  const tipo = String(formData.get("tipo") || "conciliacao");
  const modalidade = String(formData.get("modalidade") || "presencial");
  if (!TIPOS_AUDIENCIA.includes(tipo as (typeof TIPOS_AUDIENCIA)[number])) {
    return { ok: false, error: "Tipo de audiência inválido." };
  }
  if (!MODALIDADES.includes(modalidade as (typeof MODALIDADES)[number])) {
    return { ok: false, error: "Modalidade inválida." };
  }
  const vara = String(formData.get("vara") || "").trim() || null;
  const prepostoNome = String(formData.get("prepostoNome") || "").trim() || null;
  const prepostoWhatsapp = String(formData.get("prepostoWhatsapp") || "").trim() || null;

  await db.insert(audiencias).values({
    processoId,
    clienteId: p.clienteId,
    tipo: tipo as (typeof TIPOS_AUDIENCIA)[number],
    dataHora: dt,
    modalidade: modalidade as (typeof MODALIDADES)[number],
    vara,
    prepostoNome,
    prepostoWhatsapp,
  });
  await registrarAudit({ acao: "write", entidade: "audiencia", clienteId: p.clienteId, atorId: s.id, atorPapel: "escritorio" });
  revalidatePath(`/processos/${processoId}`);
  return { ok: true, message: "Audiência registrada." };
}

export async function registrarParte(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const processoId = String(formData.get("processoId") || "").trim();
  const p = await processoDoEscopo(processoId, escopoClientes(s));
  if (!p) return { ok: false, error: "Processo não encontrado." };

  const papel = String(formData.get("papel") || "").trim();
  const nome = String(formData.get("nome") || "").trim();
  if (!papel || !nome) return { ok: false, error: "Informe papel e nome." };
  const cpfCnpj = String(formData.get("cpfCnpj") || "").trim() || null;
  const ehPolo = formData.get("ehPolo") === "on";

  await db.insert(partes).values({ processoId, clienteId: p.clienteId, papel, nome, cpfCnpj, ehPolo });
  await registrarAudit({ acao: "write", entidade: "parte", clienteId: p.clienteId, atorId: s.id, atorPapel: "escritorio" });
  revalidatePath(`/processos/${processoId}`);
  return { ok: true, message: "Parte registrada." };
}

export async function registrarProvisao(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const processoId = String(formData.get("processoId") || "").trim();
  const p = await processoDoEscopo(processoId, escopoClientes(s));
  if (!p) return { ok: false, error: "Processo não encontrado." };

  const classificacao = String(formData.get("classificacao") || "possivel");
  if (!CLASSIF_PROVISAO.includes(classificacao as (typeof CLASSIF_PROVISAO)[number])) {
    return { ok: false, error: "Classificação inválida." };
  }
  const valorProvisionadoCents = parseBRLToCents(String(formData.get("valor") || ""));

  await db.insert(provisoes).values({
    processoId,
    clienteId: p.clienteId,
    classificacao: classificacao as (typeof CLASSIF_PROVISAO)[number],
    valorProvisionadoCents: valorProvisionadoCents ?? null,
    classificadoPorId: s.id,
  });
  await registrarAudit({
    acao: "write",
    entidade: "provisao",
    clienteId: p.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
    detalhe: { classificacao, valorProvisionadoCents },
  });
  revalidatePath(`/processos/${processoId}`);
  return { ok: true, message: "Provisão registrada." };
}

export async function criarTarefa(formData: FormData): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const processoId = String(formData.get("processoId") || "").trim();
  const p = await processoDoEscopo(processoId, escopoClientes(s));
  if (!p) return { ok: false, error: "Processo não encontrado." };

  const titulo = String(formData.get("titulo") || "").trim();
  if (!titulo) return { ok: false, error: "Informe o título da tarefa." };
  const prazoDataRaw = String(formData.get("prazoData") || "").trim();
  const prazoData = DATA_RE.test(prazoDataRaw) ? prazoDataRaw : null;

  await db.insert(tarefas).values({
    processoId,
    clienteId: p.clienteId,
    titulo: titulo.slice(0, 200),
    prazoData,
    responsavelId: s.id,
    status: "aberta",
  });
  await registrarAudit({
    acao: "write",
    entidade: "tarefa",
    clienteId: p.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
  });
  revalidatePath(`/processos/${processoId}`);
  return { ok: true, message: "Tarefa adicionada." };
}

export async function concluirTarefa(id: string): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const [t] = await db
    .select({ clienteId: tarefas.clienteId, processoId: tarefas.processoId })
    .from(tarefas)
    .where(eq(tarefas.id, id))
    .limit(1);
  if (!t) return { ok: false, error: "Tarefa não encontrada." };
  const esc = escopoClientes(s);
  if (esc && !esc.includes(t.clienteId)) return { ok: false, error: "Sem acesso." };

  await db
    .update(tarefas)
    .set({ status: "concluida", concluidaEm: new Date() })
    .where(eq(tarefas.id, id));
  await registrarAudit({
    acao: "write",
    entidade: "tarefa_conclusao",
    entidadeId: id,
    clienteId: t.clienteId,
    atorId: s.id,
    atorPapel: "escritorio",
  });
  if (t.processoId) revalidatePath(`/processos/${t.processoId}`);
  return { ok: true, message: "Tarefa concluída." };
}
