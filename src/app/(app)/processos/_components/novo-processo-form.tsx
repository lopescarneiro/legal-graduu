"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarProcesso } from "@/lib/actions/processos";
import { analisarCitacao } from "@/lib/actions/ia";
import type { CitacaoExtraida } from "@/lib/ia";
import { RAMOS } from "@/lib/funil-constantes";
import { Button, Card, Field, Input, inputClasses } from "@/components/ui";

type Extras = {
  vara: string;
  comarca: string;
  tribunal: string;
  dataCitacao: string;
  papelDoPolo: string;
  partes: { nome: string; papel: string; ehPolo: boolean }[];
  prazo: CitacaoExtraida["prazo"];
};

const reais = (n: number) => (n > 0 ? n.toFixed(2).replace(".", ",") : "");

export function NovoProcessoForm({
  escritorio,
  clientes,
  iaDisponivel,
}: {
  escritorio: boolean;
  clientes: { id: string; nome: string }[];
  iaDisponivel: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Campos revisáveis (pré-preenchidos pela IA)
  const [ramo, setRamo] = useState("trabalhista");
  const [numeroCnj, setNumeroCnj] = useState("");
  const [tipoAcao, setTipoAcao] = useState("");
  const [valorCausa, setValorCausa] = useState("");

  // IA
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [erroIa, setErroIa] = useState<string | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [resumoIa, setResumoIa] = useState<CitacaoExtraida | null>(null);

  async function analisar() {
    if (!arquivo) {
      setErroIa("Selecione o arquivo da citação.");
      return;
    }
    setAnalisando(true);
    setErroIa(null);
    const fd = new FormData();
    fd.append("arquivo", arquivo);
    const r = await analisarCitacao(fd);
    setAnalisando(false);
    if (!r.ok || !r.dados) {
      setErroIa(r.ok ? "Não veio nenhum dado." : r.error);
      return;
    }
    const d = r.dados;
    if (d.ramo) setRamo(d.ramo);
    setNumeroCnj(d.numeroCnj);
    setTipoAcao(d.tipoAcao);
    setValorCausa(reais(d.valorCausaReais));
    setExtras({
      vara: d.vara,
      comarca: d.comarca,
      tribunal: d.tribunal,
      dataCitacao: d.dataCitacao,
      papelDoPolo: d.papelDoPolo,
      partes: d.partes,
      prazo: d.prazo,
    });
    setResumoIa(d);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const fd = new FormData(e.currentTarget);
    if (extras) fd.set("iaJson", JSON.stringify(extras));
    const r = await criarProcesso(fd);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    router.push(r.id ? `/processos/${r.id}` : "/processos");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {iaDisponivel && (
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Analisar citação com IA</h2>
            <p className="text-xs text-muted">
              Envie o PDF (ou foto) da citação. A IA pré-preenche o processo, as partes e sugere o
              prazo — você confere tudo antes de criar. A palavra final é sua.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="text-sm text-muted file:mr-3 file:rounded-[var(--r)] file:border-0 file:bg-canvas2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
            <Button type="button" variant="secondary" size="sm" onClick={analisar} disabled={analisando}>
              {analisando ? "Analisando…" : "Analisar"}
            </Button>
          </div>
          {erroIa && <p className="text-sm text-danger">{erroIa}</p>}

          {resumoIa && (
            <div className="flex flex-col gap-2 rounded-[var(--r)] border border-line bg-canvas2 p-3 text-sm">
              <span className="font-medium text-ink">A IA detectou (confira antes de criar):</span>
              <div className="grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
                {resumoIa.tribunal && <span>Tribunal: {resumoIa.tribunal}</span>}
                {resumoIa.vara && <span>Vara: {resumoIa.vara}</span>}
                {resumoIa.comarca && <span>Comarca: {resumoIa.comarca}</span>}
                {resumoIa.dataCitacao && <span>Citação: {resumoIa.dataCitacao}</span>}
                {resumoIa.papelDoPolo && <span>Papel do polo: {resumoIa.papelDoPolo}</span>}
              </div>
              {resumoIa.partes.length > 0 && (
                <div className="text-xs text-muted">
                  Partes:{" "}
                  {resumoIa.partes
                    .map((p) => `${p.nome} (${p.papel}${p.ehPolo ? " — polo" : ""})`)
                    .join("; ")}
                </div>
              )}
              {resumoIa.prazo && (
                <div className="text-xs text-muted">
                  Prazo: {resumoIa.prazo.descricao || "resposta"} — {resumoIa.prazo.dias} dias{" "}
                  {resumoIa.prazo.contagem}
                  {resumoIa.prazo.dataPublicacao ? ` (pub. ${resumoIa.prazo.dataPublicacao})` : ""}.
                  Vira sugestão para você confirmar.
                </div>
              )}
              {resumoIa.audiencia && (
                <div className="text-xs text-warn">
                  Audiência {resumoIa.audiencia.tipo} em {resumoIa.audiencia.data}
                  {resumoIa.audiencia.hora ? ` ${resumoIa.audiencia.hora}` : ""} — cadastre no detalhe
                  do processo.
                </div>
              )}
              {resumoIa.observacoes && (
                <div className="text-xs text-ink">⚠ {resumoIa.observacoes}</div>
              )}
            </div>
          )}
        </Card>
      )}

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {escritorio && (
          <div className="sm:col-span-2">
            <Field label="Cliente">
              <select name="clienteId" className={inputClasses} required defaultValue="">
                <option value="" disabled>
                  Selecione o cliente…
                </option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="Ramo">
          <select name="ramo" className={inputClasses} value={ramo} onChange={(e) => setRamo(e.target.value)}>
            {RAMOS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.rotulo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Número CNJ (opcional)">
          <Input
            name="numeroCnj"
            placeholder="NNNNNNN-DD.AAAA.J.TR.OOOO"
            value={numeroCnj}
            onChange={(e) => setNumeroCnj(e.target.value)}
          />
        </Field>
        <Field label="Tipo de ação">
          <Input
            name="tipoAcao"
            placeholder="Ex.: Reclamação trabalhista"
            value={tipoAcao}
            onChange={(e) => setTipoAcao(e.target.value)}
          />
        </Field>
        <Field label="Valor da causa (R$)">
          <Input
            name="valorCausa"
            placeholder="0,00"
            inputMode="decimal"
            value={valorCausa}
            onChange={(e) => setValorCausa(e.target.value)}
          />
        </Field>
        {erro && <p className="text-sm text-danger sm:col-span-2">{erro}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={enviando}>
            {enviando ? "Criando…" : "Criar processo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
