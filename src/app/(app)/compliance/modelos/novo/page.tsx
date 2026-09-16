import { requireEscritorio } from "@/lib/session";
import { ModeloForm } from "../_components/modelo-form";

export const dynamic = "force-dynamic";

export default async function NovoModelo() {
  await requireEscritorio();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Novo modelo</h1>
        <p className="text-sm opacity-70">Defina a peça e os campos que o polo vai preencher.</p>
      </div>
      <ModeloForm />
    </div>
  );
}
