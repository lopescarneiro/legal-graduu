import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { consultas } from "@/db/schema";
import { requireSessao, ehEscritorio, escopoClientes } from "@/lib/session";
import { listarClientes } from "@/lib/clientes";
import { formatDateTime } from "@/lib/dates";
import { NovaConsultaForm } from "./_components/nova-consulta-form";
import { ResponderForm } from "./_components/responder-form";
import { encerrarConsulta } from "@/lib/actions/consultas";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  aberta: "bg-amber-100 text-amber-800",
  respondida: "bg-green-100 text-green-800",
  encerrada: "bg-black/10 text-black/60",
};

export default async function ConsultasPage() {
  const s = await requireSessao();
  const escritorio = ehEscritorio(s);
  const esc = escopoClientes(s);
  const semAcesso = !!esc && esc.length === 0;

  const [lista, clientes] = await Promise.all([
    semAcesso
      ? Promise.resolve([])
      : db
          .select()
          .from(consultas)
          .where(esc ? inArray(consultas.clienteId, esc) : undefined)
          .orderBy(desc(consultas.criadoEm))
          .limit(50),
    escritorio ? listarClientes() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Consultas</h1>
        <p className="text-sm opacity-70">Perguntas jurídicas — resposta em até 48h úteis.</p>
      </div>

      <NovaConsultaForm escritorio={escritorio} clientes={clientes} />

      {lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 p-6 text-sm opacity-70">
          Nenhuma consulta ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((c) => (
            <div key={c.id} className="rounded-lg border border-black/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{c.assunto}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS[c.status] ?? ""}`}>
                  {c.status}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm opacity-80">{c.pergunta}</p>
              {c.status === "aberta" && c.slaVenceEm && (
                <p className="mt-1 text-xs opacity-50">Responder até {formatDateTime(c.slaVenceEm)}</p>
              )}

              {c.resposta && (
                <div className="mt-3 rounded-md border-l-2 border-[var(--brand)] bg-black/[0.02] p-3">
                  <div className="text-xs font-medium opacity-60">Resposta do escritório</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.resposta}</p>
                </div>
              )}

              {c.status === "aberta" && escritorio && <ResponderForm consultaId={c.id} />}

              {c.status !== "encerrada" && (
                <form
                  action={async () => {
                    "use server";
                    await encerrarConsulta(c.id);
                  }}
                  className="mt-2"
                >
                  <button className="text-xs text-black/50 hover:underline">Encerrar</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
