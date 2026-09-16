import Link from "next/link";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { prazos, processos } from "@/db/schema";
import { requireSessao, escopoClientes } from "@/lib/session";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PrazosPage() {
  const s = await requireSessao();
  const esc = escopoClientes(s);
  const semAcesso = !!esc && esc.length === 0;

  const lista = semAcesso
    ? []
    : await db
        .select({
          id: prazos.id,
          tipo: prazos.tipo,
          descricao: prazos.descricao,
          dataVencimento: prazos.dataVencimento,
          dataSugerida: prazos.dataSugerida,
          nivelConfianca: prazos.nivelConfianca,
          validadoEm: prazos.validadoEm,
          processoId: processos.id,
          numeroCnj: processos.numeroCnj,
          tipoAcao: processos.tipoAcao,
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
        .orderBy(asc(prazos.dataVencimento));

  const fataisNaoConfirmados = lista.filter(
    (p) => p.tipo === "fatal_peremptorio" && !p.validadoEm,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Prazos</h1>
        <p className="text-sm opacity-70">Prazos em aberto. Fatais não confirmados ficam em destaque.</p>
      </div>

      {fataisNaoConfirmados > 0 && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠️ {fataisNaoConfirmados} prazo(s) <strong>fatal(is)</strong> aguardando confirmação humana.
        </div>
      )}

      {lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 p-6 text-sm opacity-70">
          Nenhum prazo em aberto.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
          {lista.map((p) => {
            const fatal = p.tipo === "fatal_peremptorio";
            const validado = !!p.validadoEm;
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-[10px] uppercase " +
                        (fatal ? "bg-red-100 text-red-800" : "bg-black/10 text-black/70")
                      }
                    >
                      {fatal ? "fatal" : "dilatório"}
                    </span>
                    <Link
                      href={`/processos/${p.processoId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {p.numeroCnj ?? p.tipoAcao ?? "Processo"}
                    </Link>
                    <span className="text-xs opacity-60">{p.descricao ?? "Prazo"}</span>
                  </div>
                </div>
                <div className="text-sm">
                  {validado ? (
                    <span className="text-green-700">Vence {formatDate(p.dataVencimento)}</span>
                  ) : (
                    <span className="text-amber-700">
                      Sugerido {p.dataSugerida ? formatDate(p.dataSugerida) : "—"} · confira
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
