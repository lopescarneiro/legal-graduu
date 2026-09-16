"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { responderConsulta } from "@/lib/actions/consultas";

export function ResponderForm({ consultaId }: { consultaId: string }) {
  const router = useRouter();
  const [resposta, setResposta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const r = await responderConsulta(consultaId, resposta);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setResposta("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2">
      <textarea
        value={resposta}
        onChange={(e) => setResposta(e.target.value)}
        placeholder="Escreva a resposta ao polo…"
        className="min-h-20 rounded-md border border-black/15 px-3 py-2 text-sm"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="self-start rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Responder"}
      </button>
    </form>
  );
}
