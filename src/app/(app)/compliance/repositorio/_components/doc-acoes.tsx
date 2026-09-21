"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validarDocumento, renomearDocumento } from "@/lib/actions/documentos";
import { cn, inputClasses } from "@/components/ui";

/** Ações por documento: validar conformidade (escritório) + renomear (dono). */
export function DocAcoes({
  documentoId,
  nome,
  status,
  escritorio,
}: {
  documentoId: string;
  nome: string;
  status: string;
  escritorio: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);

  async function renomear() {
    const novo = window.prompt("Novo nome do documento:", nome);
    if (novo == null) return;
    setRodando(true);
    setErro(null);
    const r = await renomearDocumento(documentoId, novo);
    setRodando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    router.refresh();
  }

  async function mudarStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    setRodando(true);
    setErro(null);
    const r = await validarDocumento(documentoId, e.target.value);
    setRodando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {escritorio && (
        <select
          defaultValue={status}
          onChange={mudarStatus}
          disabled={rodando}
          title="Validar conformidade (humano)"
          className={cn(inputClasses, "h-8 w-auto py-1 text-xs")}
        >
          <option value="nao_avaliado">Não avaliado</option>
          <option value="em_dia">Em dia</option>
          <option value="a_vencer">A vencer</option>
          <option value="pendente">Pendente</option>
        </select>
      )}
      <button
        type="button"
        onClick={renomear}
        disabled={rodando}
        className="text-xs text-brand hover:underline"
      >
        Renomear
      </button>
      {erro && <span className="text-xs text-danger">{erro}</span>}
    </div>
  );
}
