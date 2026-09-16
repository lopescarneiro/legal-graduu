import { and, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { reunioes } from "@/db/schema";
import { requireSessao, ehEscritorio, escopoClientes } from "@/lib/session";
import { listarClientes } from "@/lib/clientes";
import { formatDateTime } from "@/lib/dates";
import { AgendarForm } from "./_components/agendar-form";
import { atualizarStatusReuniao } from "@/lib/actions/reunioes";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  agendada: "bg-[var(--brand)]/10 text-[var(--brand)]",
  realizada: "bg-green-100 text-green-800",
  cancelada: "bg-black/10 text-black/60 line-through",
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
        <h1 className="text-2xl font-semibold">Reuniões</h1>
        <p className="text-sm opacity-70">2 reuniões por mês (não cumulativas).</p>
      </div>

      <AgendarForm escritorio={escritorio} clientes={clientes} />

      {lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 p-6 text-sm opacity-70">
          Nenhuma reunião agendada.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
          {lista.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="font-medium">{formatDateTime(r.dataHora)}</div>
                <div className="text-xs opacity-60">{r.tipo ?? "Reunião"}</div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS[r.status] ?? ""}`}>
                  {r.status}
                </span>
                {r.status === "agendada" && (
                  <>
                    <form
                      action={async () => {
                        "use server";
                        await atualizarStatusReuniao(r.id, "realizada");
                      }}
                    >
                      <button className="rounded-md border border-black/15 px-3 py-1 hover:bg-black/5">
                        Realizada
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await atualizarStatusReuniao(r.id, "cancelada");
                      }}
                    >
                      <button className="rounded-md border border-black/15 px-3 py-1 text-red-600 hover:bg-black/5">
                        Cancelar
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
