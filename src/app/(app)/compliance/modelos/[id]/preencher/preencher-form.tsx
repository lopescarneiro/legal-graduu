"use client";

import { useState } from "react";
import { gerarDocumento } from "@/lib/actions/modelos";
import type { CampoModelo } from "@/lib/modelos-constantes";

const inputCls = "rounded-md border border-black/15 px-3 py-2 text-sm";

export function PreencherForm({ modeloId, campos }: { modeloId: string; campos: CampoModelo[] }) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [conteudo, setConteudo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function set(chave: string, v: string) {
    setValores((x) => ({ ...x, [chave]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGerando(true);
    setErro(null);
    const r = await gerarDocumento(modeloId, valores);
    setGerando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setConteudo(r.conteudo ?? "");
  }

  async function copiar() {
    if (conteudo == null) return;
    try {
      await navigator.clipboard.writeText(conteudo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {campos.length === 0 && (
          <p className="text-sm opacity-60">Este modelo não tem campos — apenas gere o documento.</p>
        )}
        {campos.map((c) => (
          <label key={c.chave} className="flex flex-col gap-1 text-sm">
            <span>
              {c.rotulo}
              {c.obrigatorio && <span className="text-red-600"> *</span>}
            </span>
            {c.tipo === "textarea" ? (
              <textarea
                className={`${inputCls} min-h-24`}
                value={valores[c.chave] ?? ""}
                onChange={(e) => set(c.chave, e.target.value)}
              />
            ) : (
              <input
                className={inputCls}
                type={c.tipo === "date" ? "date" : c.tipo === "numero" ? "number" : "text"}
                inputMode={c.tipo === "moeda" || c.tipo === "numero" ? "decimal" : undefined}
                value={valores[c.chave] ?? ""}
                onChange={(e) => set(c.chave, e.target.value)}
              />
            )}
            {c.ajuda && <span className="text-xs opacity-60">{c.ajuda}</span>}
          </label>
        ))}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button
          type="submit"
          disabled={gerando}
          className="self-start rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {gerando ? "Gerando…" : "Gerar documento"}
        </button>
      </form>

      {conteudo != null && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Documento gerado</span>
            <button
              type="button"
              onClick={copiar}
              className="rounded-md border border-black/15 px-3 py-1 text-xs hover:bg-black/5"
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-black/10 bg-black/[0.02] p-4 text-sm">
            {conteudo}
          </pre>
        </div>
      )}
    </div>
  );
}
