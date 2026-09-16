"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmarPrazo } from "@/lib/actions/prazos";

export function ConfirmarPrazo({ prazoId, sugerida }: { prazoId: string; sugerida: string | null }) {
  const router = useRouter();
  const [data, setData] = useState(sugerida ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const r = await confirmarPrazo(prazoId, data);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs opacity-60">Confirmar data:</span>
      <input
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
        className="rounded-md border border-black/15 px-2 py-1 text-sm"
        required
      />
      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-[var(--brand)] px-3 py-1 text-sm font-medium text-white disabled:opacity-60"
      >
        {enviando ? "Confirmando…" : "Confirmar prazo"}
      </button>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </form>
  );
}
