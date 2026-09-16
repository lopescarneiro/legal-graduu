import { requireSessao, ehEscritorio } from "@/lib/session";
import { listarDocumentos } from "@/lib/documentos";
import { listarClientes } from "@/lib/clientes";
import { rotuloCategoria } from "@/lib/modelos-constantes";
import { formatDate } from "@/lib/dates";
import { Card, Badge, type BadgeProps } from "@/components/ui";
import { UploadForm } from "./_components/upload-form";

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
                      </div>
                      <a
                        href={`/api/documentos/${d.id}`}
                        className="inline-flex items-center rounded-[var(--r)] border border-line2 bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas2"
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
