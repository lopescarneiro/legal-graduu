import Link from "next/link";
import { requireSessao, ehEscritorio, escopoClientes } from "@/lib/session";
import { board } from "@/lib/funil";
import { RAMOS, type Ramo } from "@/lib/funil-constantes";
import { formatBRL } from "@/lib/money";
import { Card, Badge } from "@/components/ui";
import { MoverCard } from "./_components/mover-card";

export const dynamic = "force-dynamic";

function ramoValido(r: string | undefined): Ramo {
  return RAMOS.some((x) => x.valor === r) ? (r as Ramo) : "trabalhista";
}

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ ramo?: string }>;
}) {
  const s = await requireSessao();
  const escritorio = ehEscritorio(s);
  const sp = await searchParams;
  const ramo = ramoValido(sp.ramo);
  const esc = escopoClientes(s);
  const b = await board(ramo, esc);

  const etapasSimples = b ? b.etapas.map((e) => ({ id: e.id, nome: e.nome })) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Processos</h1>
        {escritorio && (
          <Link
            href="/processos/novo"
            className="inline-flex items-center rounded-[var(--r)] bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-[var(--sh-sm)] hover:brightness-110"
          >
            + Novo processo
          </Link>
        )}
      </div>

      <div className="flex gap-2 border-b border-line">
        {RAMOS.map((r) => (
          <Link
            key={r.valor}
            href={`/processos?ramo=${r.valor}`}
            className={
              "border-b-2 px-3 py-2 text-sm " +
              (r.valor === ramo
                ? "border-brand font-medium text-brand"
                : "border-transparent text-muted hover:text-ink")
            }
          >
            {r.rotulo}
          </Link>
        ))}
      </div>

      {!b ? (
        <Card className="border-dashed p-6 text-sm text-muted">
          Funil não configurado. Rode o seed (<code>npm run db:seed</code>).
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {b.etapas.map((et) => {
            const cards = b.cards.filter((c) => c.etapaId === et.id);
            return (
              <div key={et.id} className="w-64 shrink-0">
                <div
                  className="flex items-center justify-between border-b-2 pb-1"
                  style={{ borderColor: et.cor }}
                >
                  <span className="text-sm font-medium">{et.nome}</span>
                  <span className="text-xs text-muted">{cards.length}</span>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {cards.map((c) => (
                    <Card key={c.inscricaoId} className="p-2">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/processos/${c.processoId}`}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {c.numeroCnj ?? c.tipoAcao ?? "Processo"}
                        </Link>
                        {c.pendenteConfirmacao && <Badge tone="warn">rascunho</Badge>}
                      </div>
                      {c.valorCausaCents != null && (
                        <div className="text-xs text-muted">{formatBRL(c.valorCausaCents)}</div>
                      )}
                      {escritorio && (
                        <MoverCard inscricaoId={c.inscricaoId} etapas={etapasSimples} atual={et.id} />
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
