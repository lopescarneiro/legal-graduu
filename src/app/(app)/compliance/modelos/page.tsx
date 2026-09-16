import Link from "next/link";
import { requireSessao, ehEscritorio } from "@/lib/session";
import { listarModelos, rotuloCategoria } from "@/lib/modelos";
import { alternarAtivoModelo } from "@/lib/actions/modelos";
import { Card, Badge, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ModelosPage() {
  const s = await requireSessao();
  const escritorio = ehEscritorio(s);
  const modelos = await listarModelos(escritorio);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Modelos</h1>
          <p className="text-sm text-muted">
            {escritorio
              ? "Cadastre peças com campos que o polo preenche."
              : "Escolha um modelo, preencha os campos e gere o documento."}
          </p>
        </div>
        {escritorio && (
          <Link
            href="/compliance/modelos/novo"
            className="inline-flex items-center rounded-[var(--r)] bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-[var(--sh-sm)] hover:brightness-110"
          >
            + Novo modelo
          </Link>
        )}
      </div>

      {modelos.length === 0 ? (
        <Card className="border-dashed p-6 text-sm text-muted">
          Nenhum modelo {escritorio ? "cadastrado" : "disponível"} ainda.
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {modelos.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{m.titulo}</span>
                  {!m.ativo && <Badge tone="neutral">arquivado</Badge>}
                </div>
                <div className="text-xs text-muted">
                  {rotuloCategoria(m.categoria)} · {(m.variaveis?.length ?? 0)} campo(s)
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {m.ativo && (
                  <Link
                    href={`/compliance/modelos/${m.id}/preencher`}
                    className="inline-flex items-center rounded-[var(--r)] border border-line2 bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas2"
                  >
                    Preencher
                  </Link>
                )}
                {escritorio && (
                  <>
                    <Link
                      href={`/compliance/modelos/${m.id}/editar`}
                      className="inline-flex items-center rounded-[var(--r)] border border-line2 bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas2"
                    >
                      Editar
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await alternarAtivoModelo(m.id, !m.ativo);
                      }}
                    >
                      <Button type="submit" variant="secondary" size="sm">
                        {m.ativo ? "Arquivar" : "Reativar"}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
