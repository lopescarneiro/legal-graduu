"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  validarDocumento,
  renomearDocumento,
  excluirDocumento,
  substituirDocumento,
} from "@/lib/actions/documentos";
import { cn, inputClasses } from "@/components/ui";

/** Ações por documento: validar (escritório), renomear, nova versão e arquivar (dono). */
export function DocAcoes({
  documentoId,
  nome,
  status,
  versao,
  escritorio,
}: {
  documentoId: string;
  nome: string;
  status: string;
  versao: number;
  escritorio: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);

  async function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setRodando(true);
    setErro(null);
    const r = await fn();
    setRodando(false);
    if (!r.ok) {
      setErro(r.error ?? "Erro.");
      return;
    }
    router.refresh();
  }

  async function renomear() {
    const novo = window.prompt("Novo nome do documento:", nome);
    if (novo == null) return;
    await correr(() => renomearDocumento(documentoId, novo));
  }

  async function excluir() {
    if (!window.confirm("Arquivar este documento? Ele sai das listagens (a trilha é preservada).")) {
      return;
    }
    await correr(() => excluirDocumento(documentoId));
  }

  async function novaVersao(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("documentoId", documentoId);
    fd.set("arquivo", file);
    await correr(() => substituirDocumento(fd));
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {versao > 1 && <span className="text-[10px] text-muted">v{versao}</span>}
      {escritorio && (
        <select
          defaultValue={status}
          onChange={(e) => correr(() => validarDocumento(documentoId, e.target.value))}
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
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={rodando}
        className="text-xs text-brand hover:underline"
      >
        Nova versão
      </button>
      <input ref={fileRef} type="file" className="hidden" onChange={novaVersao} />
      <button
        type="button"
        onClick={excluir}
        disabled={rodando}
        className="text-xs text-danger hover:underline"
      >
        Arquivar
      </button>
      {erro && <span className="text-xs text-danger">{erro}</span>}
    </div>
  );
}
