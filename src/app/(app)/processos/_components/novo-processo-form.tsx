"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarProcesso } from "@/lib/actions/processos";
import { RAMOS } from "@/lib/funil-constantes";
import { Button, Field, Input, inputClasses } from "@/components/ui";

export function NovoProcessoForm({
  escritorio,
  clientes,
}: {
  escritorio: boolean;
  clientes: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const fd = new FormData(e.currentTarget);
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
        <select name="ramo" className={inputClasses} defaultValue="trabalhista">
          {RAMOS.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.rotulo}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Número CNJ (opcional)">
        <Input name="numeroCnj" placeholder="NNNNNNN-DD.AAAA.J.TR.OOOO" />
      </Field>
      <Field label="Tipo de ação">
        <Input name="tipoAcao" placeholder="Ex.: Reclamação trabalhista" />
      </Field>
      <Field label="Valor da causa (R$)">
        <Input name="valorCausa" placeholder="0,00" inputMode="decimal" />
      </Field>
      {erro && <p className="text-sm text-danger sm:col-span-2">{erro}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Criando…" : "Criar processo"}
        </Button>
      </div>
    </form>
  );
}
