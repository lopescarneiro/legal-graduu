"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { atualizarProcesso } from "@/lib/actions/processos";
import { Button, Card, Field, Input, inputClasses } from "@/components/ui";

export type ProcessoEditavel = {
  id: string;
  numeroCnj: string;
  tipoAcao: string;
  valorCausa: string;
  vara: string;
  comarca: string;
  situacao: string;
};

export function EditarProcesso({ inicial }: { inicial: ProcessoEditavel }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const r = await atualizarProcesso(inicial.id, new FormData(e.currentTarget));
    setSalvando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setAberto(true)} className="self-start">
        Editar processo
      </Button>
    );
  }

  return (
    <Card className="p-4">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Número CNJ">
          <Input name="numeroCnj" defaultValue={inicial.numeroCnj} placeholder="NNNNNNN-DD.AAAA.J.TR.OOOO" />
        </Field>
        <Field label="Tipo de ação">
          <Input name="tipoAcao" defaultValue={inicial.tipoAcao} />
        </Field>
        <Field label="Valor da causa (R$)">
          <Input name="valorCausa" defaultValue={inicial.valorCausa} inputMode="decimal" />
        </Field>
        <Field label="Situação">
          <select name="situacao" defaultValue={inicial.situacao} className={inputClasses}>
            <option value="ativo">Ativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="encerrado">Encerrado</option>
            <option value="arquivado">Arquivado</option>
          </select>
        </Field>
        <Field label="Vara">
          <Input name="vara" defaultValue={inicial.vara} />
        </Field>
        <Field label="Comarca">
          <Input name="comarca" defaultValue={inicial.comarca} />
        </Field>
        {erro && <p className="text-sm text-danger sm:col-span-2">{erro}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
