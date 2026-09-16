import { requireSessao, ehEscritorio } from "@/lib/session";
import { listarClientes } from "@/lib/clientes";
import { NovoProcessoForm } from "../_components/novo-processo-form";

export const dynamic = "force-dynamic";

export default async function NovoProcesso() {
  const s = await requireSessao();
  const escritorio = ehEscritorio(s);
  const clientes = escritorio ? await listarClientes() : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <a href="/processos" className="text-xs text-brand hover:underline">
          ← Processos
        </a>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Novo processo</h1>
        <p className="text-sm text-muted">
          Registre o processo — ele entra no funil do ramo, na primeira etapa.
        </p>
      </div>
      <NovoProcessoForm escritorio={escritorio} clientes={clientes} />
    </div>
  );
}
