"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cumprirPrazo, marcarPrazoPerdido } from "@/lib/actions/prazos";
import { Badge, Button } from "@/components/ui";

/** Baixa de prazo (só escritório): cumprido / perdido. Já baixado vira badge. */
export function BaixaPrazo({ prazoId, status }: { prazoId: string; status: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);

  if (status === "cumprido") return <Badge tone="success">cumprido</Badge>;
  if (status === "perdido") return <Badge tone="danger">perdido</Badge>;

  async function baixar(tipo: "cumprido" | "perdido") {
    if (tipo === "perdido" && !confirm("Marcar este prazo como PERDIDO? A ação fica registrada na auditoria.")) {
      return;
    }
    setRodando(true);
    setErro(null);
    const r = tipo === "cumprido" ? await cumprirPrazo(prazoId) : await marcarPrazoPerdido(prazoId);
    setRodando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <span className="ml-2 inline-flex items-center gap-1">
      <Button type="button" size="sm" variant="secondary" disabled={rodando} onClick={() => baixar("cumprido")}>
        Cumprido
      </Button>
      <Button type="button" size="sm" variant="secondary" disabled={rodando} onClick={() => baixar("perdido")}>
        Perdido
      </Button>
      {erro && <span className="text-xs text-danger">{erro}</span>}
    </span>
  );
}
