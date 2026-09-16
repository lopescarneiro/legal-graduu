"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarModelo } from "@/lib/actions/modelos";
import { TIPOS_CAMPO, CATEGORIAS, type CampoModelo, type TipoCampo } from "@/lib/modelos-constantes";

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

const inputCls = "rounded-md border border-black/15 px-3 py-2 text-sm";

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
          <span className="text-sm font-medium">Campos a preencher</span>
          <button
            type="button"
            onClick={addCampo}
            className="rounded-md border border-black/15 px-3 py-1 text-xs hover:bg-black/5"
          >
            + Campo
          </button>
        </div>
        {campos.length === 0 && (
          <p className="text-xs opacity-60">
            Nenhum campo ainda. Adicione os campos que o polo preencherá (ex.: nome do funcionário,
            salário, data de admissão).
          </p>
        )}
        {campos.map((c, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-black/10 p-2 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
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
              <button
                type="button"
                onClick={() => inserirNoCorpo(c.chave)}
                className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5"
                title="Inserir {{chave}} no corpo"
              >
                ↩ corpo
              </button>
              <button
                type="button"
                onClick={() => rmCampo(i)}
                className="rounded-md border border-black/15 px-2 py-1 text-xs text-red-600 hover:bg-black/5"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Corpo da peça
        <textarea
          className={`${inputCls} min-h-64 font-mono`}
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          placeholder="Escreva o texto da peça. Use {{chave}} onde o valor do campo deve entrar."
        />
        <span className="text-xs opacity-60">
          Use <code>{"{{chave}}"}</code> para os campos. Ex.: “Contratante: {"{{nome_funcionario}}"}”.
        </span>
      </label>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar modelo"}
        </button>
        <a
          href="/compliance/modelos"
          className="rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
