import "server-only";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { funis, funilEtapas, funilInscricoes, funilHistorico, processos, prazos } from "@/db/schema";
import { TIPO_FUNIL_POR_RAMO, type Ramo } from "./funil-constantes";

type TipoFunil = (typeof TIPO_FUNIL_POR_RAMO)[Ramo];

async function funilAtivoPorTipo(tipo: TipoFunil) {
  const [f] = await db
    .select()
    .from(funis)
    .where(and(eq(funis.tipo, tipo), eq(funis.ativo, true)))
    .orderBy(asc(funis.ordem))
    .limit(1);
  return f ?? null;
}

export async function funilDoRamo(ramo: Ramo) {
  return funilAtivoPorTipo(TIPO_FUNIL_POR_RAMO[ramo]);
}

export async function etapasDoFunil(funilId: string) {
  return db
    .select()
    .from(funilEtapas)
    .where(and(eq(funilEtapas.funilId, funilId), eq(funilEtapas.ativo, true)))
    .orderBy(asc(funilEtapas.ordem));
}

/** Inscreve o processo no funil do seu ramo, na 1ª etapa. Idempotente. */
export async function garantirInscricao(
  processoId: string,
  ramo: Ramo,
  clienteId: string,
): Promise<{ funilId: string; etapaId: string } | null> {
  const f = await funilDoRamo(ramo);
  if (!f) return null;
  const etapas = await etapasDoFunil(f.id);
  const primeira = etapas[0];
  if (!primeira) return null;

  const [existe] = await db
    .select({ id: funilInscricoes.id, etapaId: funilInscricoes.etapaId })
    .from(funilInscricoes)
    .where(and(eq(funilInscricoes.funilId, f.id), eq(funilInscricoes.entidadeId, processoId)))
    .limit(1);
  if (existe) return { funilId: f.id, etapaId: existe.etapaId ?? primeira.id };

  await db.insert(funilInscricoes).values({
    funilId: f.id,
    clienteId,
    entidade: "processo",
    entidadeId: processoId,
    etapaId: primeira.id,
  });
  await db.update(processos).set({ estagioAtualId: primeira.id }).where(eq(processos.id, processoId));
  await db.insert(funilHistorico).values({
    clienteId,
    entidade: "processo",
    entidadeId: processoId,
    funilId: f.id,
    paraEtapaId: primeira.id,
    origem: "seed",
  });
  return { funilId: f.id, etapaId: primeira.id };
}

/**
 * Move o card (inscrição) para outra etapa do MESMO funil. Suporta RETROCESSO
 * (mover para etapa anterior) — sem a idempotência once-per-chave do matriculador,
 * porque aqui a transição gera tarefa/prazo, não template de marketing.
 * `clientesPermitidos`: null = sem restrição (escritório); array = só esses; [] = nada.
 */
export async function moverEtapa(input: {
  inscricaoId: string;
  etapaDestinoId: string;
  clientesPermitidos: string[] | null;
  usuarioId: string | null;
  checarFatalPendente?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [ins] = await db
    .select()
    .from(funilInscricoes)
    .where(eq(funilInscricoes.id, input.inscricaoId))
    .limit(1);
  if (!ins) return { ok: false, error: "Card não encontrado." };
  if (input.clientesPermitidos && !input.clientesPermitidos.includes(ins.clienteId)) {
    return { ok: false, error: "Sem acesso a este processo." };
  }
  if (ins.etapaId === input.etapaDestinoId) return { ok: true };

  // Trava de segurança (revisão E6): não avança com prazo FATAL não confirmado.
  if (input.checarFatalPendente) {
    const pendente = await db
      .select({ id: prazos.id })
      .from(prazos)
      .where(
        and(
          eq(prazos.processoId, ins.entidadeId),
          eq(prazos.tipo, "fatal_peremptorio"),
          isNull(prazos.validadoEm),
          ne(prazos.status, "cumprido"),
        ),
      )
      .limit(1);
    if (pendente.length) {
      return {
        ok: false,
        error: "Há prazo fatal não confirmado neste processo — confirme o prazo antes de mover.",
      };
    }
  }

  const [etapa] = await db
    .select()
    .from(funilEtapas)
    .where(eq(funilEtapas.id, input.etapaDestinoId))
    .limit(1);
  if (!etapa || etapa.funilId !== ins.funilId) return { ok: false, error: "Etapa inválida." };

  const de = ins.etapaId;
  const agora = new Date();
  await db
    .update(funilInscricoes)
    .set({ etapaId: etapa.id, etapaDesde: agora, atualizadoEm: agora })
    .where(eq(funilInscricoes.id, ins.id));
  await db
    .update(processos)
    .set({ estagioAtualId: etapa.id, atualizadoEm: agora })
    .where(eq(processos.id, ins.entidadeId));
  await db.insert(funilHistorico).values({
    clienteId: ins.clienteId,
    entidade: "processo",
    entidadeId: ins.entidadeId,
    funilId: ins.funilId,
    deEtapaId: de,
    paraEtapaId: etapa.id,
    origem: "manual",
    usuarioId: input.usuarioId,
  });
  return { ok: true };
}

export type CardBoard = {
  inscricaoId: string;
  etapaId: string | null;
  processoId: string;
  numeroCnj: string | null;
  tipoAcao: string | null;
  valorCausaCents: number | null;
  situacao: string;
  pendenteConfirmacao: boolean;
};

/** Dados do board de um ramo, cercados por cliente. null = sem funil semeado. */
export async function board(ramo: Ramo, esc: string[] | null) {
  const f = await funilDoRamo(ramo);
  if (!f) return null;
  const etapas = await etapasDoFunil(f.id);
  if (esc && esc.length === 0) return { funil: f, etapas, cards: [] as CardBoard[] };
  const cerca = esc ? inArray(funilInscricoes.clienteId, esc) : undefined;
  const cards = await db
    .select({
      inscricaoId: funilInscricoes.id,
      etapaId: funilInscricoes.etapaId,
      processoId: processos.id,
      numeroCnj: processos.numeroCnj,
      tipoAcao: processos.tipoAcao,
      valorCausaCents: processos.valorCausaCents,
      situacao: processos.situacao,
      pendenteConfirmacao: processos.pendenteConfirmacao,
    })
    .from(funilInscricoes)
    .innerJoin(processos, eq(processos.id, funilInscricoes.entidadeId))
    .where(and(eq(funilInscricoes.funilId, f.id), cerca));
  return { funil: f, etapas, cards };
}
