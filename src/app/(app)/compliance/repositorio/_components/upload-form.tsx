"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocumento } from "@/lib/actions/documentos";
import { CATEGORIAS } from "@/lib/modelos-constantes";
import { Button, inputClasses } from "@/components/ui";

const inputCls = inputClasses;

const SIGILOS = [
  { valor: "normal", rotulo: "Normal" },
  { valor: "sensivel", rotulo: "Dados sensíveis" },
  { valor: "segredo_justica", rotulo: "Segredo de justiça" },
];

export function UploadForm({
  escritorio,
  clientes,
}: {
  escritorio: boolean;
  clientes: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    setOk(null);
    const fd = new FormData(e.currentTarget);
    const r = await uploadDocumento(fd);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setOk(r.message ?? "Enviado.");
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 rounded-[var(--r-card)] border border-line bg-card p-4 shadow-[var(--sh-sm)] sm:grid-cols-2"
    >
      {escritorio && (
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Cliente
          <select name="clienteId" className={inputCls} required defaultValue="">
            <option value="" disabled>
              Selecione o cliente…
            </option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Nome do documento
        <input name="nome" className={inputCls} placeholder="Ex.: Contrato — Fornecedor X" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Categoria
        <select name="categoria" className={inputCls} defaultValue="outros">
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Sigilo
        <select name="sigilo" className={inputCls} defaultValue="normal">
          {SIGILOS.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Vencimento (opcional)
        <input name="vencimento" type="date" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Arquivo
        <input name="arquivo" type="file" className={inputCls} required />
      </label>

      {erro && <p className="text-sm text-danger sm:col-span-2">{erro}</p>}
      {ok && <p className="text-sm text-success sm:col-span-2">{ok}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar documento"}
        </Button>
      </div>
    </form>
  );
}
