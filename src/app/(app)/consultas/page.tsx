import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { consultas } from "@/db/schema";
import { requireSessao, ehEscritorio, escopoClientes } from "@/lib/session";
import { listarClientes } from "@/lib/clientes";
import { formatDateTime } from "@/lib/dates";
import { NovaConsultaForm } from "./_components/nova-consulta-form";
import { ResponderForm } from "./_components/responder-form";
import { encerrarConsulta } from "@/lib/actions/consultas";
import { Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "warn" | "success" | "neutral"> = {
  aberta: "warn",
  respondida: "success",
  encerrada: "neutral",
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
        <h1 className="text-2xl font-bold tracking-tight text-ink">Consultas</h1>
        <p className="text-sm text-muted">Perguntas jurídicas — resposta em até 48h úteis.</p>
      </div>

      <NovaConsultaForm escritorio={escritorio} clientes={clientes} />

      {lista.length === 0 ? (
        <Card className="border-dashed p-6 text-sm text-muted">
          Nenhuma consulta ainda.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{c.assunto}</span>
                <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{c.pergunta}</p>
              {c.status === "aberta" && c.slaVenceEm && (
                <p className="mt-1 text-xs text-muted">Responder até {formatDateTime(c.slaVenceEm)}</p>
              )}

              {c.resposta && (
                <div className="mt-3 rounded-md border-l-2 border-brand bg-canvas2 p-3">
                  <div className="text-xs font-medium text-muted">Resposta do escritório</div>
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
                  <button className="text-xs text-muted hover:text-ink">Encerrar</button>
                </form>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
