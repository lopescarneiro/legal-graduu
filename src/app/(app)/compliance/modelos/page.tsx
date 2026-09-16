import Link from "next/link";
import { requireSessao, ehEscritorio } from "@/lib/session";
import { listarModelos, rotuloCategoria } from "@/lib/modelos";
import { alternarAtivoModelo } from "@/lib/actions/modelos";

export const dynamic = "force-dynamic";

export default async function ModelosPage() {
  const s = await requireSessao();
  const escritorio = ehEscritorio(s);
  const modelos = await listarModelos(escritorio);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Modelos</h1>
          <p className="text-sm opacity-70">
            {escritorio
              ? "Cadastre peças com campos que o polo preenche."
              : "Escolha um modelo, preencha os campos e gere o documento."}
          </p>
        </div>
        {escritorio && (
          <Link
            href="/compliance/modelos/novo"
            className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white"
          >
            + Novo modelo
          </Link>
        )}
      </div>

      {modelos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 p-6 text-sm opacity-70">
          Nenhum modelo {escritorio ? "cadastrado" : "disponível"} ainda.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
          {modelos.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.titulo}</span>
                  {!m.ativo && (
                    <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] uppercase">
                      arquivado
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-60">
                  {rotuloCategoria(m.categoria)} · {(m.variaveis?.length ?? 0)} campo(s)
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {m.ativo && (
                  <Link
                    href={`/compliance/modelos/${m.id}/preencher`}
                    className="rounded-md border border-black/15 px-3 py-1 hover:bg-black/5"
                  >
                    Preencher
                  </Link>
                )}
                {escritorio && (
                  <>
                    <Link
                      href={`/compliance/modelos/${m.id}/editar`}
                      className="rounded-md border border-black/15 px-3 py-1 hover:bg-black/5"
                    >
                      Editar
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await alternarAtivoModelo(m.id, !m.ativo);
                      }}
                    >
                      <button className="rounded-md border border-black/15 px-3 py-1 hover:bg-black/5">
                        {m.ativo ? "Arquivar" : "Reativar"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
