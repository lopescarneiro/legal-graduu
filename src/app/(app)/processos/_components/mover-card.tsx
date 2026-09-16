"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moverEtapaProcesso } from "@/lib/actions/processos";

export function MoverCard({
  inscricaoId,
  etapas,
  atual,
}: {
  inscricaoId: string;
  etapas: { id: string; nome: string }[];
  atual: string;
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const dest = e.target.value;
    if (dest === atual) return;
    setCarregando(true);
    const r = await moverEtapaProcesso(inscricaoId, dest);
    setCarregando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <select
      value={atual}
      onChange={onChange}
      disabled={carregando}
      className="mt-1 w-full rounded border border-black/15 px-1 py-0.5 text-xs disabled:opacity-50"
      title="Mover para etapa (permite retrocesso)"
    >
      {etapas.map((e) => (
        <option key={e.id} value={e.id}>
          {e.nome}
        </option>
      ))}
    </select>
  );
}
