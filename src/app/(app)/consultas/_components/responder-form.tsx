"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { responderConsulta } from "@/lib/actions/consultas";
import { Button, inputClasses, cn } from "@/components/ui";

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
        className={cn(inputClasses, "h-auto min-h-20 py-2")}
      />
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <Button type="submit" size="sm" disabled={enviando} className="self-start">
        {enviando ? "Enviando…" : "Responder"}
      </Button>
    </form>
  );
}
