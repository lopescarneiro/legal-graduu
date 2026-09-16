import { requireSessao, ehEscritorio } from "@/lib/session";
import { listarDocumentos } from "@/lib/documentos";
import { listarClientes } from "@/lib/clientes";
import { rotuloCategoria } from "@/lib/modelos-constantes";
import { formatDate } from "@/lib/dates";
import { UploadForm } from "./_components/upload-form";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { rotulo: string; cls: string }> = {
  em_dia: { rotulo: "Em dia", cls: "bg-green-100 text-green-800" },
  a_vencer: { rotulo: "A vencer", cls: "bg-amber-100 text-amber-800" },
  pendente: { rotulo: "Pendente", cls: "bg-red-100 text-red-800" },
  nao_avaliado: { rotulo: "Não avaliado", cls: "bg-black/10 text-black/70" },
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
        <a href="/compliance" className="text-xs text-[var(--brand)] hover:underline">
          ← Compliance
        </a>
        <h1 className="text-2xl font-semibold">Repositório</h1>
        <p className="text-sm opacity-70">Documentos por categoria, com status e vencimento.</p>
      </div>

      <UploadForm escritorio={escritorio} clientes={clientes} />

      {docs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 p-6 text-sm opacity-70">
          Nenhum documento ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...porCategoria.entries()].map(([cat, lista]) => (
            <div key={cat} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold opacity-80">{rotuloCategoria(cat)}</h2>
              <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
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
                            <span className="text-xs opacity-50">v{d.versao}</span>
                          )}
                          {d.sigilo !== "normal" && (
                            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] uppercase text-red-700">
                              {d.sigilo === "segredo_justica" ? "segredo" : "sensível"}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs opacity-60">
                          <span className={`rounded px-1.5 py-0.5 ${st.cls}`}>{st.rotulo}</span>
                          {d.vencimentoEm && <span>vence {formatDate(d.vencimentoEm)}</span>}
                        </div>
                      </div>
                      <a
                        href={`/api/documentos/${d.id}`}
                        className="rounded-md border border-black/15 px-3 py-1 text-sm hover:bg-black/5"
                      >
                        Baixar
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
