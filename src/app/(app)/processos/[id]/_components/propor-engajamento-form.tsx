"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporEngajamento } from "@/lib/actions/engajamentos";
import { Button, inputClasses } from "@/components/ui";

const inputCls = inputClasses;

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
      className="grid grid-cols-1 gap-2 rounded-[var(--r-card)] border border-line bg-card p-3 shadow-[var(--sh-sm)] sm:grid-cols-2"
    >
      <input type="hidden" name="processoId" value={processoId} />
      <input name="descricao" className={`${inputCls} sm:col-span-2`} placeholder="Demanda (ex.: Defesa em reclamação trabalhista)" />
      <input name="valor" className={inputCls} placeholder="Valor (R$)" inputMode="decimal" />
      <input name="honorarios" className={inputCls} placeholder="Honorários (descrição)" />
      <input name="exito" className={`${inputCls} sm:col-span-2`} placeholder="Êxito, se houver (ex.: 10% da economia)" />
      {erro && <p className="text-sm text-danger sm:col-span-2">{erro}</p>}
      {ok && <p className="text-sm text-success sm:col-span-2">{ok}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar proposta"}
        </Button>
      </div>
    </form>
  );
}
