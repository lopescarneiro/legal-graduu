"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporEngajamento } from "@/lib/actions/engajamentos";

const inputCls = "rounded-md border border-black/15 px-3 py-2 text-sm";

export function ProporEngajamentoForm({ processoId }: { processoId: string }) {
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
    const r = await proporEngajamento(new FormData(e.currentTarget));
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
      className="grid grid-cols-1 gap-2 rounded-md border border-black/10 p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="processoId" value={processoId} />
      <input name="descricao" className={`${inputCls} sm:col-span-2`} placeholder="Demanda (ex.: Defesa em reclamação trabalhista)" />
      <input name="valor" className={inputCls} placeholder="Valor (R$)" inputMode="decimal" />
      <input name="honorarios" className={inputCls} placeholder="Honorários (descrição)" />
      <input name="exito" className={`${inputCls} sm:col-span-2`} placeholder="Êxito, se houver (ex.: 10% da economia)" />
      {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
      {ok && <p className="text-sm text-[var(--success,#16a34a)] sm:col-span-2">{ok}</p>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Enviar proposta"}
        </button>
      </div>
    </form>
  );
}
