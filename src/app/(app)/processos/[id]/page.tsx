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
import { Card, Badge, Button } from "@/components/ui";

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
        <a href="/processos" className="text-xs text-brand hover:underline">
          ← Processos
        </a>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {p.numeroCnj ?? p.tipoAcao ?? "Processo"}
        </h1>
        {p.pendenteConfirmacao && (
          <span className="text-xs text-warn">Rascunho — pendente de confirmação</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {campos.map((c) => (
          <Card key={c.rotulo} className="p-3">
            <div className="text-xs text-muted">{c.rotulo}</div>
            <div className="text-sm font-medium">{c.valor}</div>
          </Card>
        ))}
      </div>

      {ehEscritorio(s) && p.segredoJustica && (
        <Card className="border-danger/40 bg-danger-tint px-3 py-2 text-sm text-danger">
          Processo em segredo de justiça.
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Prazos</h2>
        {escritorio && <NovoPrazoForm processoId={p.id} />}
        {listaPrazos.length === 0 ? (
          <Card className="p-6 text-sm text-muted">Nenhum prazo registrado.</Card>
        ) : (
          <Card className="flex flex-col divide-y divide-line">
            {listaPrazos.map((pz) => {
              const validado = !!pz.validadoEm;
              const fatal = pz.tipo === "fatal_peremptorio";
              return (
                <div key={pz.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={fatal ? "danger" : "neutral"}>
                      {fatal ? "fatal" : "dilatório"}
                    </Badge>
                    <span className="font-medium">{pz.descricao ?? "Prazo"}</span>
                  </div>
                  {validado ? (
                    <div className="mt-1 text-sm">
                      <span className="text-success">✓ Vence {formatDate(pz.dataVencimento)}</span>
                      <span className="ml-2 text-xs text-muted">
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
                          <span className="text-xs text-muted">confiança {pz.nivelConfianca}%</span>
                        )}
                        <Badge tone="warn">confira</Badge>
                      </div>
                      {(pz.motivosIncerteza?.length ?? 0) > 0 && (
                        <ul className="mt-1 list-disc pl-5 text-xs text-muted">
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
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Honorários (contencioso)</h2>
        {escritorio && <ProporEngajamentoForm processoId={p.id} />}
        {listaEngajamentos.length === 0 ? (
          <Card className="p-6 text-sm text-muted">Nenhuma proposta.</Card>
        ) : (
          <Card className="flex flex-col divide-y divide-line">
            {listaEngajamentos.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{e.descricao}</span>
                  <Badge
                    tone={
                      e.status === "aceito"
                        ? "success"
                        : e.status === "recusado"
                          ? "neutral"
                          : "warn"
                    }
                  >
                    {e.status}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-muted">
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
                      <Button type="submit" size="sm">
                        Aceitar
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await decidirEngajamento(e.id, false);
                      }}
                    >
                      <Button type="submit" size="sm" variant="secondary">
                        Recusar
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Audiências</h2>
        {escritorio && <AudienciaForm processoId={p.id} />}
        {listaAudiencias.length === 0 ? (
          <Card className="p-6 text-sm text-muted">Nenhuma audiência.</Card>
        ) : (
          <Card className="flex flex-col divide-y divide-line">
            {listaAudiencias.map((a) => (
              <div key={a.id} className="px-4 py-2 text-sm">
                <span className="font-medium">{formatDateTime(a.dataHora)}</span> · {a.tipo} ·{" "}
                {a.modalidade}
                {a.vara && <span className="text-muted"> · {a.vara}</span>}
                {a.prepostoNome && <span className="text-muted"> · preposto: {a.prepostoNome}</span>}
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Andamentos</h2>
        {escritorio && <AndamentoForm processoId={p.id} />}
        {listaAndamentos.length === 0 ? (
          <Card className="p-6 text-sm text-muted">Nenhum andamento.</Card>
        ) : (
          <Card className="flex flex-col divide-y divide-line">
            {listaAndamentos.map((a) => (
              <div key={a.id} className="px-4 py-2 text-sm">
                <span className="text-muted">{formatDate(a.data)}</span> — {a.descricao}
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Partes</h2>
        {escritorio && <ParteForm processoId={p.id} />}
        {listaPartes.length === 0 ? (
          <Card className="p-6 text-sm text-muted">Nenhuma parte.</Card>
        ) : (
          <Card className="flex flex-col divide-y divide-line">
            {listaPartes.map((pt) => (
              <div key={pt.id} className="px-4 py-2 text-sm">
                <Badge tone="neutral">{pt.papel}</Badge> {pt.nome}
                {pt.cpfCnpj && <span className="text-muted"> · {pt.cpfCnpj}</span>}
                {pt.ehPolo && <span className="ml-1 text-[10px] text-brand">(polo)</span>}
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
