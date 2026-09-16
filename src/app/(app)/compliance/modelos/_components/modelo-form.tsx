"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarModelo } from "@/lib/actions/modelos";
import { TIPOS_CAMPO, CATEGORIAS, type CampoModelo, type TipoCampo } from "@/lib/modelos-constantes";
import { Card, Button, inputClasses, cn } from "@/components/ui";

export type ModeloInicial = {
  titulo: string;
  categoria: string;
  descricao: string;
  corpo: string;
  variaveis: CampoModelo[];
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const inputCls = inputClasses;

export function ModeloForm({ modeloId, inicial }: { modeloId?: string; inicial?: ModeloInicial }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [categoria, setCategoria] = useState(inicial?.categoria ?? "outros");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [corpo, setCorpo] = useState(inicial?.corpo ?? "");
  const [campos, setCampos] = useState<CampoModelo[]>(inicial?.variaveis ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function addCampo() {
    setCampos((c) => [...c, { chave: "", rotulo: "", tipo: "text", obrigatorio: false }]);
  }
  function upCampo(i: number, patch: Partial<CampoModelo>) {
    setCampos((c) =>
      c.map((x, j) => {
        if (j !== i) return x;
        const next = { ...x, ...patch };
        // auto-deriva a chave do rótulo enquanto a chave estiver vazia/derivada
        if (patch.rotulo !== undefined && (!x.chave || x.chave === slug(x.rotulo))) {
          next.chave = slug(patch.rotulo);
        }
        return next;
      }),
    );
  }
  function rmCampo(i: number) {
    setCampos((c) => c.filter((_, j) => j !== i));
  }
  function inserirNoCorpo(chave: string) {
    if (!chave) return;
    setCorpo((c) => `${c}{{${chave}}}`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const r = await salvarModelo(modeloId ?? null, {
      titulo,
      categoria,
      descricao,
      corpo,
      variaveis: campos,
    });
    setSalvando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    router.push("/compliance/modelos");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Título da peça
          <input
            className={inputCls}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Contrato de Experiência (CLT)"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Categoria
          <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Descrição (opcional)
        <input
          className={inputCls}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Quando o polo deve usar esta peça"
        />
      </label>

      {/* Campos que o polo vai preencher */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-ink">Campos a preencher</span>
          <Button type="button" variant="secondary" size="sm" onClick={addCampo}>
            + Campo
          </Button>
        </div>
        {campos.length === 0 && (
          <p className="text-xs text-muted">
            Nenhum campo ainda. Adicione os campos que o polo preencherá (ex.: nome do funcionário,
            salário, data de admissão).
          </p>
        )}
        {campos.map((c, i) => (
          <Card key={i} className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
            <input
              className={inputCls}
              value={c.rotulo}
              onChange={(e) => upCampo(i, { rotulo: e.target.value })}
              placeholder="Rótulo (ex.: Nome do funcionário)"
            />
            <input
              className={inputCls}
              value={c.chave}
              onChange={(e) => upCampo(i, { chave: e.target.value })}
              placeholder="chave"
              title="Usada no corpo como {{chave}}"
            />
            <select
              className={inputCls}
              value={c.tipo}
              onChange={(e) => upCampo(i, { tipo: e.target.value as TipoCampo })}
            >
              {TIPOS_CAMPO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={c.obrigatorio}
                onChange={(e) => upCampo(i, { obrigatorio: e.target.checked })}
              />
              Obrig.
            </label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => inserirNoCorpo(c.chave)}
                title="Inserir {{chave}} no corpo"
              >
                ↩ corpo
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => rmCampo(i)}
                className="text-danger"
              >
                ✕
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Corpo da peça
        <textarea
          className={cn(inputCls, "h-auto min-h-64 py-2 font-mono")}
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          placeholder="Escreva o texto da peça. Use {{chave}} onde o valor do campo deve entrar."
        />
        <span className="text-xs text-muted">
          Use <code>{"{{chave}}"}</code> para os campos. Ex.: “Contratante: {"{{nome_funcionario}}"}”.
        </span>
      </label>

      {erro && <p className="text-sm text-danger">{erro}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar modelo"}
        </Button>
        <a
          href="/compliance/modelos"
          className="inline-flex items-center rounded-[var(--r)] border border-line2 bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-canvas2"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
