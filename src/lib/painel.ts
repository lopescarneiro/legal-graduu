import "server-only";
import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { processos, prazos, audiencias, funilEtapas } from "@/db/schema";
import { todayISO, addDays, parseISO, format } from "./dates";

const emNDias = (n: number) => format(addDays(parseISO(todayISO()), n), "yyyy-MM-dd");

export async function kpisEscritorio(esc: string[] | null) {
  const vazio = { ativos: 0, prazos7: 0, fatais: 0, aud7: 0, riscoCents: 0 };
  if (esc && esc.length === 0) return vazio;
  const cProc = esc ? inArray(processos.clienteId, esc) : undefined;
  const cPrazo = esc ? inArray(prazos.clienteId, esc) : undefined;
  const cAud = esc ? inArray(audiencias.clienteId, esc) : undefined;
  const hoje = todayISO();
  const em7 = emNDias(7);
  const agora = new Date();
  const daqui7 = addDays(agora, 7);

  const [a, p7, f, au, r] = await Promise.all([
    db.select({ n: count() }).from(processos).where(and(cProc, eq(processos.situacao, "ativo"))),
    db
      .select({ n: count() })
      .from(prazos)
      .where(
        and(
          cPrazo,
          isNotNull(prazos.validadoEm),
          isNotNull(prazos.dataVencimento),
          gte(prazos.dataVencimento, hoje),
          lte(prazos.dataVencimento, em7),
          ne(prazos.status, "cumprido"),
        ),
      ),
    db
      .select({ n: count() })
      .from(prazos)
      .where(
        and(
          cPrazo,
          eq(prazos.tipo, "fatal_peremptorio"),
          isNull(prazos.validadoEm),
          ne(prazos.status, "cumprido"),
        ),
      ),
    db
      .select({ n: count() })
      .from(audiencias)
      .where(and(cAud, gte(audiencias.dataHora, agora), lte(audiencias.dataHora, daqui7))),
    db
      .select({ s: sql<number>`coalesce(sum(${processos.valorCausaCents}),0)` })
      .from(processos)
      .where(and(cProc, eq(processos.situacao, "ativo"))),
  ]);
  return {
    ativos: Number(a[0]?.n ?? 0),
    prazos7: Number(p7[0]?.n ?? 0),
    fatais: Number(f[0]?.n ?? 0),
    aud7: Number(au[0]?.n ?? 0),
    riscoCents: Number(r[0]?.s ?? 0),
  };
}

export async function proximosPrazos(esc: string[] | null, limite = 8) {
  if (esc && esc.length === 0) return [];
  return db
    .select({
      id: prazos.id,
      descricao: prazos.descricao,
      tipo: prazos.tipo,
      dataVencimento: prazos.dataVencimento,
      dataSugerida: prazos.dataSugerida,
      validadoEm: prazos.validadoEm,
      processoId: processos.id,
      numeroCnj: processos.numeroCnj,
    })
    .from(prazos)
    .innerJoin(processos, eq(processos.id, prazos.processoId))
    .where(
      and(
        esc ? inArray(prazos.clienteId, esc) : undefined,
        ne(prazos.status, "cumprido"),
        ne(prazos.status, "perdido"),
      ),
    )
    .orderBy(asc(prazos.dataVencimento))
    .limit(limite);
}

export async function processosDoPolo(esc: string[] | null) {
  if (esc && esc.length === 0) return [];
  return db
    .select({
      id: processos.id,
      numeroCnj: processos.numeroCnj,
      tipoAcao: processos.tipoAcao,
      valorCausaCents: processos.valorCausaCents,
      situacao: processos.situacao,
      etapaChave: funilEtapas.chave,
    })
    .from(processos)
    .leftJoin(funilEtapas, eq(funilEtapas.id, processos.estagioAtualId))
    .where(
      and(esc ? inArray(processos.clienteId, esc) : undefined, ne(processos.situacao, "arquivado")),
    )
    .orderBy(asc(processos.criadoEm));
}
