import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { audiencias, processos, clientes } from "@/db/schema";
import { requireSessao, escopoClientes, ehEscritorio } from "@/lib/session";
import { formatDateTime } from "@/lib/dates";
import { Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AudienciasPage() {
  const s = await requireSessao();
  const escritorio = ehEscritorio(s);
  const esc = escopoClientes(s);
  const semAcesso = !!esc && esc.length === 0;

  const agora = new Date();
  const lista = semAcesso
    ? []
    : await db
        .select({
          id: audiencias.id,
          dataHora: audiencias.dataHora,
          tipo: audiencias.tipo,
          modalidade: audiencias.modalidade,
          vara: audiencias.vara,
          processoId: processos.id,
          numeroCnj: processos.numeroCnj,
          tipoAcao: processos.tipoAcao,
          poloNome: clientes.nome,
        })
        .from(audiencias)
        .innerJoin(processos, eq(processos.id, audiencias.processoId))
        .leftJoin(clientes, eq(clientes.id, audiencias.clienteId))
        .where(esc ? inArray(audiencias.clienteId, esc) : undefined)
        .orderBy(asc(audiencias.dataHora));

  const futuras = lista.filter((a) => a.dataHora >= agora);
  const passadas = lista.filter((a) => a.dataHora < agora).reverse();

  function Linha({ a }: { a: (typeof lista)[number] }) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{formatDateTime(a.dataHora)}</span>
            <Badge tone="neutral">{a.tipo}</Badge>
            <Badge tone={a.modalidade === "virtual" ? "info" : "neutral"}>{a.modalidade}</Badge>
          </div>
          <div className="mt-0.5 text-xs text-muted">
            <Link href={`/processos/${a.processoId}`} className="text-brand hover:underline">
              {a.numeroCnj ?? a.tipoAcao ?? "Processo"}
            </Link>
            {a.vara && <span> · {a.vara}</span>}
            {escritorio && a.poloNome && <span> · {a.poloNome}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Audiências</h1>
        <p className="text-sm text-muted">Agenda de audiências dos processos.</p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">Próximas</h2>
        {futuras.length === 0 ? (
          <Card className="border-dashed p-6 text-sm text-muted">Nenhuma audiência agendada.</Card>
        ) : (
          <Card className="flex flex-col divide-y divide-line">
            {futuras.map((a) => (
              <Linha key={a.id} a={a} />
            ))}
          </Card>
        )}
      </div>

      {passadas.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">Anteriores</h2>
          <Card className="flex flex-col divide-y divide-line opacity-70">
            {passadas.map((a) => (
              <Linha key={a.id} a={a} />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
