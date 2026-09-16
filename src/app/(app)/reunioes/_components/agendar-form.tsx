"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { agendarReuniao } from "@/lib/actions/reunioes";

const inputCls = "rounded-md border border-black/15 px-3 py-2 text-sm";

export function AgendarForm({
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
    const r = await agendarReuniao(new FormData(e.currentTarget));
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setOk(r.message ?? "Agendada.");
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-2"
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
        Data e hora
        <input name="dataHora" type="datetime-local" className={inputCls} required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Assunto (opcional)
        <input name="tipo" className={inputCls} placeholder="Ex.: Revisão de contratos" />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Link da reunião (opcional)
        <input name="link" className={inputCls} placeholder="https://…" />
      </label>
      {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
      {ok && <p className="text-sm text-[var(--success,#16a34a)] sm:col-span-2">{ok}</p>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {enviando ? "Agendando…" : "Agendar reunião"}
        </button>
      </div>
    </form>
  );
}
