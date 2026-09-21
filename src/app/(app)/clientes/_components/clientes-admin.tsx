"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarCliente, atualizarCliente } from "@/lib/actions/clientes";
import { Button, Card, Badge, Field, Input, inputClasses, type BadgeProps } from "@/components/ui";

export type ClienteRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  status: string;
};

const TOM_STATUS: Record<string, BadgeProps["tone"]> = {
  ativo: "success",
  inadimplente: "warn",
  inativo: "neutral",
};

function NovoCliente() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const r = await criarCliente(new FormData(e.currentTarget));
    setSalvando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    (e.target as HTMLFormElement).reset();
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <Button type="button" onClick={() => setAberto(true)} className="self-start">
        + Cadastrar polo
      </Button>
    );
  }
  return (
    <Card className="p-4">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Field label="Nome do polo">
            <Input name="nome" required placeholder="Ex.: Polo Centro EAD Ltda" />
          </Field>
        </div>
        <Field label="CNPJ (opcional)">
          <Input name="cnpj" placeholder="00.000.000/0000-00" />
        </Field>
        <Field label="Telefone (WhatsApp)">
          <Input name="telefone" placeholder="+55 11 90000-0000" />
        </Field>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
        </div>
        {erro && <p className="text-sm text-danger sm:col-span-3">{erro}</p>}
      </form>
    </Card>
  );
}

function LinhaCliente({ c }: { c: ClienteRow }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const r = await atualizarCliente(c.id, new FormData(e.currentTarget));
    setSalvando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setEditando(false);
    router.refresh();
  }

  if (editando) {
    return (
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-4">
        <Input name="nome" defaultValue={c.nome} required placeholder="Nome" />
        <Input name="cnpj" defaultValue={c.cnpj ?? ""} placeholder="CNPJ" />
        <Input name="telefone" defaultValue={c.telefone ?? ""} placeholder="Telefone" />
        <div className="flex items-center gap-2">
          <select name="status" defaultValue={c.status} className={inputClasses}>
            <option value="ativo">Ativo</option>
            <option value="inadimplente">Inadimplente</option>
            <option value="inativo">Inativo</option>
          </select>
          <Button type="submit" size="sm" disabled={salvando}>
            {salvando ? "…" : "Salvar"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditando(false)}>
            ✕
          </Button>
        </div>
        {erro && <p className="text-sm text-danger sm:col-span-4">{erro}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{c.nome}</span>
          <Badge tone={TOM_STATUS[c.status] ?? "neutral"}>{c.status}</Badge>
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {c.cnpj ? `CNPJ ${c.cnpj}` : "sem CNPJ"}
          {c.telefone ? ` · ${c.telefone}` : " · sem telefone"}
        </div>
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={() => setEditando(true)}>
        Editar
      </Button>
    </div>
  );
}

export function ClientesAdmin({ clientes }: { clientes: ClienteRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <NovoCliente />
      {clientes.length === 0 ? (
        <Card className="border-dashed p-6 text-sm text-muted">
          Nenhum polo cadastrado ainda. Cadastre o primeiro para começar a operar.
        </Card>
      ) : (
        <Card className="flex flex-col divide-y divide-line">
          {clientes.map((c) => (
            <LinhaCliente key={c.id} c={c} />
          ))}
        </Card>
      )}
    </div>
  );
}
