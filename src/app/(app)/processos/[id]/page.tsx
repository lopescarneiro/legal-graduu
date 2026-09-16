import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  processos,
  funilEtapas,
  prazos,
  andamentos,
  audiencias,
  partes,
  engajamentosContencioso,
} from "@/db/schema";
import { requireSessao, escopoClientes, ehEscritorio } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { rotuloRamo } from "@/lib/funil-constantes";
import { NovoPrazoForm } from "./_components/novo-prazo-form";
import { ConfirmarPrazo } from "./_components/confirmar-prazo";
import { AndamentoForm, AudienciaForm, ParteForm } from "./_components/registrar-itens";
import { ProporEngajamentoForm } from "./_components/propor-engajamento-form";
import { decidirEngajamento } from "@/lib/actions/engajamentos";

export const dynamic = "force-dynamic";

export default async function ProcessoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSessao();
  const { id } = await params;

  const [p] = await db.select().from(processos).where(eq(processos.id, id)).limit(1);
  if (!p) notFound();

  // Cerca por cliente.
  const esc = escopoClientes(s);
  if (esc && !esc.includes(p.clienteId)) notFound();

  const etapa = p.estagioAtualId
    ? (await db.select().from(funilEtapas).where(eq(funilEtapas.id, p.estagioAtualId)).limit(1))[0]
    : null;

  const escritorio = ehEscritorio(s);
  const listaPrazos = await db
    .select()
    .from(prazos)
    .where(eq(prazos.processoId, p.id))
    .orderBy(asc(prazos.criadoEm));

  const [listaAndamentos, listaAudiencias, listaPartes, listaEngajamentos] = await Promise.all([
    db.select().from(andamentos).where(eq(andamentos.processoId, p.id)).orderBy(desc(andamentos.data)),
    db.select().from(audiencias).where(eq(audiencias.processoId, p.id)).orderBy(asc(audiencias.dataHora)),
    db.select().from(partes).where(eq(partes.processoId, p.id)),
    db
      .select()
      .from(engajamentosContencioso)
      .where(eq(engajamentosContencioso.processoId, p.id))
      .orderBy(desc(engajamentosContencioso.propostoEm)),
  ]);

  const campos: { rotulo: string; valor: string }[] = [
    { rotulo: "Ramo", valor: rotuloRamo(p.ramo) },
    { rotulo: "Tipo de ação", valor: p.tipoAcao ?? "—" },
    { rotulo: "Número CNJ", valor: p.numeroCnj ?? "CNJ pendente" },
    { rotulo: "Etapa atual", valor: etapa?.nome ?? "—" },
    { rotulo: "Situação", valor: p.situacao },
    { rotulo: "Fase", valor: p.faseMacro },
    { rotulo: "Valor da causa", valor: p.valorCausaCents != null ? formatBRL(p.valorCausaCents) : "—" },
    { rotulo: "Papel do polo", valor: p.papelDoPolo },
    { rotulo: "Comarca", valor: p.comarca ?? "—" },
    { rotulo: "Data da citação", valor: p.dataCitacao ? formatDate(p.dataCitacao) : "—" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <a href="/processos" className="text-xs text-[var(--brand)] hover:underline">
          ← Processos
        </a>
        <h1 className="text-2xl font-semibold">{p.numeroCnj ?? p.tipoAcao ?? "Processo"}</h1>
        {p.pendenteConfirmacao && (
          <span className="text-xs text-amber-700">Rascunho — pendente de confirmação</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {campos.map((c) => (
          <div key={c.rotulo} className="rounded-lg border border-black/10 p-3">
            <div className="text-xs opacity-60">{c.rotulo}</div>
            <div className="text-sm font-medium">{c.valor}</div>
          </div>
        ))}
      </div>

      {ehEscritorio(s) && p.segredoJustica && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Processo em segredo de justiça.
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Prazos</h2>
        {escritorio && <NovoPrazoForm processoId={p.id} />}
        {listaPrazos.length === 0 ? (
          <p className="text-sm opacity-60">Nenhum prazo registrado.</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
            {listaPrazos.map((pz) => {
              const validado = !!pz.validadoEm;
              const fatal = pz.tipo === "fatal_peremptorio";
              return (
                <div key={pz.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-[10px] uppercase " +
                        (fatal ? "bg-red-100 text-red-800" : "bg-black/10 text-black/70")
                      }
                    >
                      {fatal ? "fatal" : "dilatório"}
                    </span>
                    <span className="font-medium">{pz.descricao ?? "Prazo"}</span>
                  </div>
                  {validado ? (
                    <div className="mt-1 text-sm">
                      <span className="text-green-700">✓ Vence {formatDate(pz.dataVencimento)}</span>
                      <span className="ml-2 text-xs opacity-50">
                        validado {formatDateTime(pz.validadoEm)}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          Sugerido:{" "}
                          {pz.dataSugerida ? formatDate(pz.dataSugerida) : "— (cálculo manual)"}
                        </span>
                        {pz.nivelConfianca != null && (
                          <span className="text-xs opacity-60">confiança {pz.nivelConfianca}%</span>
                        )}
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase text-amber-800">
                          confira
                        </span>
                      </div>
                      {(pz.motivosIncerteza?.length ?? 0) > 0 && (
                        <ul className="mt-1 list-disc pl-5 text-xs opacity-60">
                          {pz.motivosIncerteza!.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      )}
                      {escritorio && <ConfirmarPrazo prazoId={pz.id} sugerida={pz.dataSugerida} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Honorários (contencioso)</h2>
        {escritorio && <ProporEngajamentoForm processoId={p.id} />}
        {listaEngajamentos.length === 0 ? (
          <p className="text-sm opacity-60">Nenhuma proposta.</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
            {listaEngajamentos.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{e.descricao}</span>
                  <span
                    className={
                      "rounded px-2 py-0.5 text-xs " +
                      (e.status === "aceito"
                        ? "bg-green-100 text-green-800"
                        : e.status === "recusado"
                          ? "bg-black/10 text-black/60"
                          : "bg-amber-100 text-amber-800")
                    }
                  >
                    {e.status}
                  </span>
                </div>
                <div className="mt-1 text-sm opacity-70">
                  {e.valorCents != null && <span>{formatBRL(e.valorCents)}</span>}
                  {e.honorariosDescricao && <span> · {e.honorariosDescricao}</span>}
                  {e.exitoDescricao && <span> · êxito: {e.exitoDescricao}</span>}
                </div>
                {e.status === "proposto" && (
                  <div className="mt-2 flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await decidirEngajamento(e.id, true);
                      }}
                    >
                      <button className="rounded-md bg-[var(--brand)] px-3 py-1 text-sm text-white">
                        Aceitar
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await decidirEngajamento(e.id, false);
                      }}
                    >
                      <button className="rounded-md border border-black/15 px-3 py-1 text-sm">
                        Recusar
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Audiências</h2>
        {escritorio && <AudienciaForm processoId={p.id} />}
        {listaAudiencias.length === 0 ? (
          <p className="text-sm opacity-60">Nenhuma audiência.</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
            {listaAudiencias.map((a) => (
              <div key={a.id} className="px-4 py-2 text-sm">
                <span className="font-medium">{formatDateTime(a.dataHora)}</span> · {a.tipo} ·{" "}
                {a.modalidade}
                {a.vara && <span className="opacity-60"> · {a.vara}</span>}
                {a.prepostoNome && <span className="opacity-60"> · preposto: {a.prepostoNome}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Andamentos</h2>
        {escritorio && <AndamentoForm processoId={p.id} />}
        {listaAndamentos.length === 0 ? (
          <p className="text-sm opacity-60">Nenhum andamento.</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
            {listaAndamentos.map((a) => (
              <div key={a.id} className="px-4 py-2 text-sm">
                <span className="opacity-60">{formatDate(a.data)}</span> — {a.descricao}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Partes</h2>
        {escritorio && <ParteForm processoId={p.id} />}
        {listaPartes.length === 0 ? (
          <p className="text-sm opacity-60">Nenhuma parte.</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
            {listaPartes.map((pt) => (
              <div key={pt.id} className="px-4 py-2 text-sm">
                <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] uppercase">
                  {pt.papel}
                </span>{" "}
                {pt.nome}
                {pt.cpfCnpj && <span className="opacity-60"> · {pt.cpfCnpj}</span>}
                {pt.ehPolo && <span className="ml-1 text-[10px] text-[var(--brand)]">(polo)</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
