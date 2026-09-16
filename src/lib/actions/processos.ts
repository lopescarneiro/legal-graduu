"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { processos } from "@/db/schema";
import {
  requireSessao,
  requireEscritorio,
  somenteLeitura,
  ehEscritorio,
  escopoClientes,
} from "@/lib/session";
import { parseBRLToCents } from "@/lib/money";
import { garantirInscricao, moverEtapa } from "@/lib/funil";
import { registrarAudit } from "@/lib/audit";
import type { Ramo } from "@/lib/funil-constantes";
import type { ActionResult } from "@/lib/actions/result";

const RAMOS: Ramo[] = ["trabalhista", "civel", "consumidor"];

export async function criarProcesso(
  formData: FormData,
): Promise<ActionResult & { id?: string }> {
  const s = await requireSessao();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };

  const ramo = String(formData.get("ramo") || "") as Ramo;
  if (!RAMOS.includes(ramo)) return { ok: false, error: "Ramo inválido." };

  let clienteId: string | null;
  if (ehEscritorio(s)) {
    clienteId = String(formData.get("clienteId") || "").trim() || null;
    if (!clienteId) return { ok: false, error: "Selecione o cliente." };
  } else {
    clienteId = s.clienteId;
    if (!clienteId) return { ok: false, error: "Sessão sem cliente." };
  }

  const numeroCnj = String(formData.get("numeroCnj") || "").trim() || null;
  const tipoAcao = String(formData.get("tipoAcao") || "").trim() || null;
  const valorCausaCents = parseBRLToCents(String(formData.get("valorCausa") || ""));

  const [row] = await db
    .insert(processos)
    .values({
      clienteId,
      ramo,
      numeroCnj,
      tipoAcao,
      valorCausaCents: valorCausaCents ?? null,
      papelDoPolo: "reu",
      situacao: "ativo",
      advogadoResponsavelId: ehEscritorio(s) ? s.id : null,
    })
    .returning({ id: processos.id });

  if (row) await garantirInscricao(row.id, ramo, clienteId);
  await registrarAudit({
    acao: "write",
    entidade: "processo",
    entidadeId: row?.id,
    clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
    detalhe: { ramo, numeroCnj },
  });
  revalidatePath("/processos");
  return { ok: true, id: row?.id, message: "Processo criado." };
}

/** Mover card no board — operação do ESCRITÓRIO. */
export async function moverEtapaProcesso(
  inscricaoId: string,
  etapaDestinoId: string,
): Promise<ActionResult> {
  const s = await requireEscritorio();
  if (somenteLeitura(s)) return { ok: false, error: "Sessão somente leitura." };
  const esc = escopoClientes(s);
  const r = await moverEtapa({
    inscricaoId,
    etapaDestinoId,
    clientesPermitidos: esc,
    usuarioId: s.id,
    checarFatalPendente: true,
  });
  if (!r.ok) return r;
  revalidatePath("/processos");
  return { ok: true };
}
