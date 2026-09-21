import Link from "next/link";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { prazos, processos, clientes } from "@/db/schema";
import { requireSessao, escopoClientes, ehEscritorio } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PrazosPage() {
  const s = await requireSessao();
  const escritorio = ehEscritorio(s);
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
          poloNome: clientes.nome,
        })
        .from(prazos)
        .innerJoin(processos, eq(processos.id, prazos.processoId))
        .leftJoin(clientes, eq(clientes.id, prazos.clienteId))
        .where(
          and(
            esc ? inArray(prazos.clienteId, esc) : undefined,
            ne(prazos.status, "cumprido"),
            ne(prazos.status, "perdido"),
          ),
        )
        .orderBy(asc(prazos.dataVencimento));

  // O polo só vê prazos JÁ VALIDADOS pelo escritório (nunca a sugestão da máquina,
  // a confiança, os motivos de incerteza ou o banner de fatais pendentes).
  const visiveis = escritorio ? lista : lista.filter((p) => !!p.validadoEm);

  const fataisNaoConfirmados = lista.filter(
    (p) => p.tipo === "fatal_peremptorio" && !p.validadoEm,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Prazos</h1>
        <p className="text-sm text-muted">
          {escritorio
            ? "Prazos em aberto. Fatais não confirmados ficam em destaque."
            : "Seus prazos confirmados pelo escritório."}
        </p>
      </div>

      {escritorio && fataisNaoConfirmados > 0 && (
        <div className="rounded-md bg-danger-tint px-4 py-3 text-sm text-danger">
          ⚠️ {fataisNaoConfirmados} prazo(s) <strong>fatal(is)</strong> aguardando confirmação humana.
        </div>
      )}

      {visiveis.length === 0 ? (
        <Card className="border-dashed p-6 text-sm text-muted">
          Nenhum prazo em aberto.
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {visiveis.map((p) => {
            const fatal = p.tipo === "fatal_peremptorio";
            const validado = !!p.validadoEm;
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={fatal ? "danger" : "neutral"} className="uppercase">
                      {fatal ? "fatal" : "dilatório"}
                    </Badge>
                    <Link
                      href={`/processos/${p.processoId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {p.numeroCnj ?? p.tipoAcao ?? "Processo"}
                    </Link>
                    <span className="text-xs text-muted">{p.descricao ?? "Prazo"}</span>
                    {escritorio && p.poloNome && (
                      <span className="text-xs text-brand">· {p.poloNome}</span>
                    )}
                  </div>
                </div>
                <div className="text-sm">
                  {validado ? (
                    <span className="text-success">Vence {formatDate(p.dataVencimento)}</span>
                  ) : (
                    <span className="text-warn">
                      Sugerido {p.dataSugerida ? formatDate(p.dataSugerida) : "—"} · confira
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
