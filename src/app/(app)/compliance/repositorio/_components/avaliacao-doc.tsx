"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { avaliarDocumentoIA } from "@/lib/actions/documentos";
import type { AvaliacaoDocumento } from "@/lib/ia";
import { Badge, Button } from "@/components/ui";

export function AvaliacaoDoc({
  documentoId,
  elegivel,
  motivo,
  inicial,
}: {
  documentoId: string;
  elegivel: boolean;
  motivo?: string;
  inicial: AvaliacaoDocumento | null;
}) {
  const router = useRouter();
  const [av, setAv] = useState<AvaliacaoDocumento | null>(inicial);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  async function avaliar() {
    setRodando(true);
    setErro(null);
    const r = await avaliarDocumentoIA(documentoId);
    setRodando(false);
    if (!r.ok || !r.avaliacao) {
      setErro(r.ok ? "Sem retorno da IA." : r.error);
      return;
    }
    setAv(r.avaliacao);
    setAberto(true);
    router.refresh();
  }

  const temIssue = !!av && (av.pendencias.length > 0 || av.riscos.length > 0);

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {av && (
          <>
            <Badge tone={temIssue ? "warn" : "neutral"}>IA: {av.score}/100</Badge>
            <button
              type="button"
              onClick={() => setAberto((x) => !x)}
              className="text-xs text-brand hover:underline"
            >
              {aberto ? "ocultar parecer" : "ver parecer"}
            </button>
          </>
        )}
        {elegivel && (
          <Button type="button" variant="secondary" size="sm" onClick={avaliar} disabled={rodando}>
            {rodando ? "Avaliando…" : av ? "Reavaliar (IA)" : "Avaliar com IA"}
          </Button>
        )}
        {!elegivel && !av && motivo && <span className="text-xs text-muted">{motivo}</span>}
      </div>

      {erro && <p className="text-xs text-danger">{erro}</p>}

      {av && aberto && (
        <div className="flex flex-col gap-2 rounded-[var(--r)] border border-line bg-canvas2 p-3 text-xs">
          {av.resumo && <p className="text-ink">{av.resumo}</p>}
          {av.pendencias.length > 0 && (
            <div>
              <span className="font-medium text-ink">Pendências</span>
              <ul className="ml-4 list-disc text-muted">
                {av.pendencias.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {av.riscos.length > 0 && (
            <div>
              <span className="font-medium text-ink">Riscos</span>
              <ul className="ml-4 list-disc text-muted">
                {av.riscos.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-muted">
            Parecer <strong>assistivo</strong> — não substitui a revisão do advogado. A conformidade
            é validada por um humano.
          </p>
        </div>
      )}
    </div>
  );
}
