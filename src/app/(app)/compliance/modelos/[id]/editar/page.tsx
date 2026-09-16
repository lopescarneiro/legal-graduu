import { notFound } from "next/navigation";
import { requireEscritorio } from "@/lib/session";
import { obterModelo } from "@/lib/modelos";
import { ModeloForm } from "../../_components/modelo-form";

export const dynamic = "force-dynamic";

export default async function EditarModelo({ params }: { params: Promise<{ id: string }> }) {
  await requireEscritorio();
  const { id } = await params;
  const m = await obterModelo(id);
  if (!m) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Editar modelo</h1>
        <p className="text-sm opacity-70">{m.titulo}</p>
      </div>
      <ModeloForm
        modeloId={m.id}
        inicial={{
          titulo: m.titulo,
          categoria: m.categoria,
          descricao: m.descricao ?? "",
          corpo: m.corpo,
          variaveis: m.variaveis ?? [],
        }}
      />
    </div>
  );
}
