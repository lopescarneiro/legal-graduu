"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { criarPrazo } from "@/lib/actions/prazos";

const inputCls = "rounded-md border border-black/15 px-3 py-2 text-sm";

export function NovoPrazoForm({ processoId }: { processoId: string }) {
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
    const r = await criarPrazo(new FormData(e.currentTarget));
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setOk(r.message ?? "Calculado.");
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-2"
    >
      <input type="hidden" name="processoId" value={processoId} />
      <label className="flex flex-col gap-1 text-sm">
        Tipo
        <select name="tipo" className={inputCls} defaultValue="fatal_peremptorio">
          <option value="fatal_peremptorio">Fatal (peremptório)</option>
          <option value="dilatorio">Dilatório</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Descrição
        <input name="descricao" className={inputCls} placeholder="Ex.: Contestação" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Meio da comunicação
        <select name="meio" className={inputCls} defaultValue="djen">
          <option value="djen">DJEN</option>
          <option value="domicilio">Domicílio Judicial Eletrônico</option>
          <option value="oficial">Oficial de justiça</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contagem
        <select name="contagem" className={inputCls} defaultValue="uteis">
          <option value="uteis">Dias úteis</option>
          <option value="corridos">Dias corridos</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Dias
        <input name="dias" type="number" min={1} className={inputCls} placeholder="15" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Data da publicação
        <input name="dataPublicacao" type="date" className={inputCls} />
      </label>
      {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
      {ok && <p className="text-sm text-[var(--success,#16a34a)] sm:col-span-2">{ok}</p>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {enviando ? "Calculando…" : "Calcular prazo (sugestão)"}
        </button>
      </div>
    </form>
  );
}
