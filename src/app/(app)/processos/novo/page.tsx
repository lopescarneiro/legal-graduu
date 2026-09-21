import { requireEscritorio } from "@/lib/session";
import { listarClientes } from "@/lib/clientes";
import { iaConfigurada } from "@/lib/ia";
import { NovoProcessoForm } from "../_components/novo-processo-form";

export const dynamic = "force-dynamic";

export default async function NovoProcesso() {
  // Abrir processo é ato do escritório — o polo é redirecionado para "/".
  await requireEscritorio();
  const clientes = await listarClientes();

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
      <NovoProcessoForm escritorio clientes={clientes} iaDisponivel={iaConfigurada()} />
    </div>
  );
}
