import { desc, inArray } from "drizzle-orm";
import { requireSessao, ehEscritorio } from "@/lib/session";
import { db } from "@/db";
import { documentoAvaliacoes } from "@/db/schema";
import { listarDocumentos } from "@/lib/documentos";
import { listarClientes } from "@/lib/clientes";
import { iaConfigurada, type AvaliacaoDocumento } from "@/lib/ia";
import { rotuloCategoria } from "@/lib/modelos-constantes";
import { formatDate } from "@/lib/dates";
import { Card, Badge, type BadgeProps } from "@/components/ui";
import { UploadForm } from "./_components/upload-form";
import { AvaliacaoDoc } from "./_components/avaliacao-doc";
import { DocAcoes } from "./_components/doc-acoes";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { rotulo: string; tone: BadgeProps["tone"] }> = {
  em_dia: { rotulo: "Em dia", tone: "success" },
  a_vencer: { rotulo: "A vencer", tone: "warn" },
  pendente: { rotulo: "Pendente", tone: "danger" },
  nao_avaliado: { rotulo: "Não avaliado", tone: "neutral" },
};

type Doc = Awaited<ReturnType<typeof listarDocumentos>>[number];

export default async function Repositorio() {
  const s = await requireSessao();
  const escritorio = ehEscritorio(s);
  const [docs, clientes] = await Promise.all([
    listarDocumentos(s),
    escritorio ? listarClientes() : Promise.resolve([]),
  ]);

  const porCategoria = new Map<string, Doc[]>();
  for (const d of docs) {
    const arr = porCategoria.get(d.categoria) ?? [];
    arr.push(d);
    porCategoria.set(d.categoria, arr);
  }

  // IA (parecer/score) é INTERNA do escritório — polo não dispara nem vê (OAB L1).
  const iaDisponivel = iaConfigurada() && escritorio;
  const docIds = docs.map((d) => d.id);
  const avaliacoes =
    escritorio && docIds.length
      ? await db
          .select()
          .from(documentoAvaliacoes)
          .where(inArray(documentoAvaliacoes.documentoId, docIds))
          .orderBy(desc(documentoAvaliacoes.criadoEm))
      : [];
  const ultimaAval = new Map<string, AvaliacaoDocumento>();
  for (const a of avaliacoes) {
    if (!ultimaAval.has(a.documentoId)) {
      ultimaAval.set(a.documentoId, {
        resumo: a.resumo ?? "",
        pendencias: a.pendencias ?? [],
        riscos: a.riscos ?? [],
        score: a.score ?? 0,
      });
    }
  }

  function elegibilidade(d: Doc): { elegivel: boolean; motivo?: string } {
    if (!iaDisponivel) return { elegivel: false };
    if (d.sigilo !== "normal" || d.contemDadosSensiveis) {
      return { elegivel: false, motivo: "sigiloso — fora da IA" };
    }
    const mime = d.mime ?? "";
    if (mime !== "application/pdf" && !mime.startsWith("image/")) {
      return { elegivel: false, motivo: "IA: envie PDF/imagem" };
    }
    return { elegivel: true };
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <a href="/compliance" className="text-xs text-brand hover:underline">
          ← Compliance
        </a>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Repositório</h1>
        <p className="text-sm text-muted">Documentos por categoria, com status e vencimento.</p>
      </div>

      <UploadForm escritorio={escritorio} clientes={clientes} />

      {docs.length === 0 ? (
        <Card className="border-dashed p-6 text-sm text-muted">
          Nenhum documento ainda.
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {[...porCategoria.entries()].map(([cat, lista]) => (
            <div key={cat} className="flex flex-col gap-2">
              <h2 className="text-base font-semibold text-ink">{rotuloCategoria(cat)}</h2>
              <Card className="flex flex-col divide-y divide-line">
                {lista.map((d) => {
                  const st = STATUS[d.status] ?? STATUS.nao_avaliado;
                  return (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{d.nome}</span>
                          {d.versao > 1 && (
                            <span className="text-xs text-muted">v{d.versao}</span>
                          )}
                          {d.sigilo !== "normal" && (
                            <Badge tone="danger">
                              {d.sigilo === "segredo_justica" ? "segredo" : "sensível"}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                          <Badge tone={st.tone}>{st.rotulo}</Badge>
                          {d.vencimentoEm && <span>vence {formatDate(d.vencimentoEm)}</span>}
                        </div>
                        {escritorio &&
                          (() => {
                            const el = elegibilidade(d);
                            return (
                              <AvaliacaoDoc
                                documentoId={d.id}
                                elegivel={el.elegivel}
                                motivo={el.motivo}
                                inicial={ultimaAval.get(d.id) ?? null}
                              />
                            );
                          })()}
                        <DocAcoes
                          documentoId={d.id}
                          nome={d.nome}
                          status={d.status}
                          versao={d.versao}
                          escritorio={escritorio}
                        />
                      </div>
                      <a
                        href={`/api/documentos/${d.id}`}
                        className="inline-flex items-center self-start rounded-[var(--r)] border border-line2 bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas2"
                      >
                        Baixar
                      </a>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
