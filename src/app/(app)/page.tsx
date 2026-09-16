import Link from "next/link";
import { requireSessao, ehEscritorio, escopoClientes } from "@/lib/session";
import { kpisEscritorio, proximosPrazos, processosDoPolo } from "@/lib/painel";
import { statusHumanizado } from "@/lib/funil-constantes";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Card, Badge, cn } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Painel() {
  const s = await requireSessao();
  const esc = escopoClientes(s);

  if (ehEscritorio(s)) {
    const [kpis, prazos] = await Promise.all([kpisEscritorio(esc), proximosPrazos(esc, 8)]);
    const stats = [
      { rotulo: "Processos ativos", valor: String(kpis.ativos) },
      { rotulo: "Prazos a vencer (7d)", valor: String(kpis.prazos7) },
      { rotulo: "Fatais não confirmados", valor: String(kpis.fatais), alerta: kpis.fatais > 0 },
      { rotulo: "Audiências (7d)", valor: String(kpis.aud7) },
      { rotulo: "Valor em risco", valor: formatBRL(kpis.riscoCents) },
    ];
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Painel do escritório</h1>
          <p className="text-sm text-muted">Carteira de todos os clientes.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((st) => (
            <Card key={st.rotulo} className={cn("p-4", st.alerta && "border-danger/40 bg-danger-tint")}>
              <div className={cn("text-2xl font-bold", st.alerta ? "text-danger" : "text-ink")}>
                {st.valor}
              </div>
              <div className="mt-0.5 text-xs text-muted">{st.rotulo}</div>
            </Card>
          ))}
        </div>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Próximos prazos</h2>
            <Link href="/prazos" className="text-sm font-medium text-brand hover:underline">
              Ver todos
            </Link>
          </div>
          {prazos.length === 0 ? (
            <Card className="p-6 text-sm text-muted">Nenhum prazo em aberto.</Card>
          ) : (
            <Card className="divide-y divide-line">
              {prazos.map((p) => {
                const fatal = p.tipo === "fatal_peremptorio";
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge tone={fatal ? "danger" : "neutral"}>{fatal ? "fatal" : "dilatório"}</Badge>
                      <Link
                        href={`/processos/${p.processoId}`}
                        className="truncate text-sm font-medium text-ink hover:underline"
                      >
                        {p.numeroCnj ?? "Processo"}
                      </Link>
                      <span className="truncate text-xs text-muted">{p.descricao ?? "Prazo"}</span>
                    </div>
                    <span className="shrink-0 text-sm">
                      {p.validadoEm ? (
                        <span className="font-medium text-success">{formatDate(p.dataVencimento)}</span>
                      ) : (
                        <span className="text-warn">
                          {p.dataSugerida ? `${formatDate(p.dataSugerida)} · confira` : "confira"}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </Card>
          )}
        </section>
      </div>
    );
  }

  // ---- Visão do POLO (cliente) — simplificada ----
  const processos = await processosDoPolo(esc);
  const exposicao = processos.reduce(
    (acc, p) => acc + (p.situacao === "ativo" ? p.valorCausaCents ?? 0 : 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Meu jurídico</h1>
        <p className="text-sm text-muted">Acompanhe seus processos e pendências.</p>
      </div>

      <Card className="bg-[image:var(--grad)] p-5 text-white">
        <div className="text-xs opacity-90">Minha exposição total (processos ativos)</div>
        <div className="text-3xl font-bold">{formatBRL(exposicao)}</div>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">Meus processos</h2>
        {processos.length === 0 ? (
          <Card className="p-6 text-sm text-muted">Nenhum processo.</Card>
        ) : (
          <Card className="divide-y divide-line">
            {processos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/processos/${p.id}`}
                    className="truncate text-sm font-medium text-ink hover:underline"
                  >
                    {p.numeroCnj ?? p.tipoAcao ?? "Processo"}
                  </Link>
                  {p.valorCausaCents != null && (
                    <div className="text-xs text-muted">{formatBRL(p.valorCausaCents)}</div>
                  )}
                </div>
                <Badge tone="brand">{statusHumanizado(p.etapaChave)}</Badge>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
