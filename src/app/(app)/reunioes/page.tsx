import { and, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { reunioes } from "@/db/schema";
import { requireSessao, ehEscritorio, escopoClientes } from "@/lib/session";
import { listarClientes } from "@/lib/clientes";
import { formatDateTime } from "@/lib/dates";
import { AgendarForm } from "./_components/agendar-form";
import { atualizarStatusReuniao } from "@/lib/actions/reunioes";
import { Card, Badge, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "brand" | "success" | "neutral"> = {
  agendada: "brand",
  realizada: "success",
  cancelada: "neutral",
};

export default async function ReunioesPage() {
  const s = await requireSessao();
  const escritorio = ehEscritorio(s);
  const esc = escopoClientes(s);
  const semAcesso = !!esc && esc.length === 0;

  const [lista, clientes] = await Promise.all([
    semAcesso
      ? Promise.resolve([])
      : db
          .select()
          .from(reunioes)
          .where(esc ? inArray(reunioes.clienteId, esc) : undefined)
          .orderBy(desc(reunioes.dataHora))
          .limit(50),
    escritorio ? listarClientes() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Reuniões</h1>
        <p className="text-sm text-muted">2 reuniões por mês (não cumulativas).</p>
      </div>

      <AgendarForm escritorio={escritorio} clientes={clientes} />

      {lista.length === 0 ? (
        <Card className="border-dashed p-6 text-sm text-muted">
          Nenhuma reunião agendada.
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {lista.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="font-medium">{formatDateTime(r.dataHora)}</div>
                <div className="text-xs text-muted">{r.tipo ?? "Reunião"}</div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge
                  tone={STATUS_TONE[r.status] ?? "neutral"}
                  className={r.status === "cancelada" ? "line-through" : undefined}
                >
                  {r.status}
                </Badge>
                {r.status === "agendada" && (
                  <>
                    <form
                      action={async () => {
                        "use server";
                        await atualizarStatusReuniao(r.id, "realizada");
                      }}
                    >
                      <Button variant="secondary" size="sm">
                        Realizada
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await atualizarStatusReuniao(r.id, "cancelada");
                      }}
                    >
                      <Button variant="danger" size="sm">
                        Cancelar
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
