"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarProcesso } from "@/lib/actions/processos";
import { RAMOS } from "@/lib/funil-constantes";

const inputCls = "rounded-md border border-black/15 px-3 py-2 text-sm";

export function NovoProcessoForm({
  escritorio,
  clientes,
}: {
  escritorio: boolean;
  clientes: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const r = await criarProcesso(fd);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    router.push(r.id ? `/processos/${r.id}` : "/processos");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        Ramo
        <select name="ramo" className={inputCls} defaultValue="trabalhista">
          {RAMOS.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Número CNJ (opcional)
        <input name="numeroCnj" className={inputCls} placeholder="NNNNNNN-DD.AAAA.J.TR.OOOO" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tipo de ação
        <input name="tipoAcao" className={inputCls} placeholder="Ex.: Reclamação trabalhista" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Valor da causa (R$)
        <input name="valorCausa" className={inputCls} placeholder="0,00" inputMode="decimal" />
      </label>
      {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {enviando ? "Criando…" : "Criar processo"}
        </button>
      </div>
    </form>
  );
}
