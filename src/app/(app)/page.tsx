import Link from "next/link";
import { requireSessao, ehEscritorio, escopoClientes } from "@/lib/session";
import { kpisEscritorio, proximosPrazos, processosDoPolo } from "@/lib/painel";
import { statusHumanizado } from "@/lib/funil-constantes";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function Painel() {
  const s = await requireSessao();
  const esc = escopoClientes(s);

  if (ehEscritorio(s)) {
    const [kpis, prazos] = await Promise.all([kpisEscritorio(esc), proximosPrazos(esc, 8)]);
    const stats = [
      { rotulo: "Processos ativos", valor: String(kpis.ativos) },
      { rotulo: "Prazos a vencer (7d)", valor: String(kpis.prazos7) },
      {
        rotulo: "Fatais não confirmados",
        valor: String(kpis.fatais),
        alerta: kpis.fatais > 0,
      },
      { rotulo: "Audiências (7d)", valor: String(kpis.aud7) },
      { rotulo: "Valor em risco", valor: formatBRL(kpis.riscoCents) },
    ];
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Painel do escritório</h1>
          <p className="text-sm opacity-70">Carteira de todos os clientes.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((st) => (
            <div
              key={st.rotulo}
              className={
                "rounded-lg border p-4 " +
                (st.alerta ? "border-red-300 bg-red-50" : "border-black/10")
              }
            >
              <div className={"text-2xl font-semibold " + (st.alerta ? "text-red-700" : "")}>
                {st.valor}
              </div>
              <div className="text-xs opacity-70">{st.rotulo}</div>
            </div>
          ))}
        </div>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Próximos prazos</h2>
            <Link href="/prazos" className="text-sm text-[var(--brand)] hover:underline">
              Ver todos
            </Link>
          </div>
          {prazos.length === 0 ? (
            <p className="text-sm opacity-60">Nenhum prazo em aberto.</p>
          ) : (
            <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
              {prazos.map((p) => {
                const fatal = p.tipo === "fatal_peremptorio";
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-2">
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
                        {p.numeroCnj ?? "Processo"}
                      </Link>
                      <span className="text-xs opacity-60">{p.descricao ?? "Prazo"}</span>
                    </div>
                    <span className="text-sm">
                      {p.validadoEm ? (
                        <span className="text-green-700">{formatDate(p.dataVencimento)}</span>
                      ) : (
                        <span className="text-amber-700">
                          {p.dataSugerida ? `${formatDate(p.dataSugerida)} · confira` : "confira"}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
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
        <h1 className="text-2xl font-semibold">Meu jurídico</h1>
        <p className="text-sm opacity-70">Acompanhe seus processos e pendências.</p>
      </div>

      <div className="rounded-lg border border-black/10 p-4">
        <div className="text-xs opacity-70">Minha exposição total (processos ativos)</div>
        <div className="text-3xl font-semibold">{formatBRL(exposicao)}</div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Meus processos</h2>
        {processos.length === 0 ? (
          <p className="text-sm opacity-60">Nenhum processo.</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
            {processos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div>
                  <Link
                    href={`/processos/${p.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {p.numeroCnj ?? p.tipoAcao ?? "Processo"}
                  </Link>
                  {p.valorCausaCents != null && (
                    <div className="text-xs opacity-60">{formatBRL(p.valorCausaCents)}</div>
                  )}
                </div>
                <span className="rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs text-[var(--brand)]">
                  {statusHumanizado(p.etapaChave)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
