"use client";

import { useState } from "react";
import { gerarDocumento } from "@/lib/actions/modelos";
import type { CampoModelo } from "@/lib/modelos-constantes";
import { Button, buttonVariants, inputClasses, cn } from "@/components/ui";

const inputCls = inputClasses;

export function PreencherForm({ modeloId, campos }: { modeloId: string; campos: CampoModelo[] }) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [conteudo, setConteudo] = useState<string | null>(null);
  const [geracaoId, setGeracaoId] = useState<string | null>(null);
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
    setGeracaoId(r.geracaoId ?? null);
  }

  const baixar = (fmt: "docx" | "pdf") =>
    `/compliance/modelos/${modeloId}/preencher/download?g=${geracaoId}&fmt=${fmt}`;

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
          <p className="text-sm text-muted">Este modelo não tem campos — apenas gere o documento.</p>
        )}
        {campos.map((c) => (
          <label key={c.chave} className="flex flex-col gap-1 text-sm">
            <span>
              {c.rotulo}
              {c.obrigatorio && <span className="text-danger"> *</span>}
            </span>
            {c.tipo === "textarea" ? (
              <textarea
                className={cn(inputCls, "h-auto min-h-24 py-2")}
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
            {c.ajuda && <span className="text-xs text-muted">{c.ajuda}</span>}
          </label>
        ))}
        {erro && <p className="text-sm text-danger">{erro}</p>}
        <Button type="submit" disabled={gerando} className="self-start">
          {gerando ? "Gerando…" : "Gerar documento"}
        </Button>
      </form>

      {conteudo != null && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-semibold text-ink">Documento gerado</span>
            <div className="flex items-center gap-2">
              {geracaoId && (
                <>
                  <a
                    href={baixar("docx")}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    Baixar Word
                  </a>
                  <a
                    href={baixar("pdf")}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    Baixar PDF
                  </a>
                </>
              )}
              <Button type="button" variant="secondary" size="sm" onClick={copiar}>
                {copiado ? "Copiado!" : "Copiar"}
              </Button>
            </div>
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-canvas2 p-4 text-sm">
            {conteudo}
          </pre>
        </div>
      )}
    </div>
  );
}
