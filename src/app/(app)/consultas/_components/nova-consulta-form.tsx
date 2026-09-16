"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { criarConsulta } from "@/lib/actions/consultas";

const inputCls = "rounded-md border border-black/15 px-3 py-2 text-sm";

export function NovaConsultaForm({
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
    const r = await criarConsulta(new FormData(e.currentTarget));
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setOk(r.message ?? "Enviada.");
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4"
    >
      {escritorio && (
        <label className="flex flex-col gap-1 text-sm">
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
        Assunto
        <input name="assunto" className={inputCls} placeholder="Resumo da dúvida" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Pergunta
        <textarea name="pergunta" className={`${inputCls} min-h-24`} />
      </label>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {ok && <p className="text-sm text-[var(--success,#16a34a)]">{ok}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="self-start rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviar consulta"}
      </button>
    </form>
  );
}
