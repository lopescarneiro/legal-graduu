"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  registrarAndamento,
  registrarAudiencia,
  registrarParte,
} from "@/lib/actions/processo-itens";

const inputCls = "rounded-md border border-black/15 px-3 py-2 text-sm";

type Acao = (fd: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>;

function Form({
  action,
  processoId,
  submitLabel,
  children,
}: {
  action: Acao;
  processoId: string;
  submitLabel: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const r = await action(new FormData(e.currentTarget));
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error ?? "Erro.");
      return;
    }
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-2 rounded-md border border-black/10 p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="processoId" value={processoId} />
      {children}
      {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
      <div className="sm:col-span-2">
        <button
          disabled={enviando}
          className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {enviando ? "Salvando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function AndamentoForm({ processoId }: { processoId: string }) {
  return (
    <Form action={registrarAndamento} processoId={processoId} submitLabel="Registrar andamento">
      <input name="data" type="date" className={inputCls} />
      <input name="descricao" className={inputCls} placeholder="Descrição do andamento" />
    </Form>
  );
}

export function AudienciaForm({ processoId }: { processoId: string }) {
  return (
    <Form action={registrarAudiencia} processoId={processoId} submitLabel="Registrar audiência">
      <input name="dataHora" type="datetime-local" className={inputCls} />
      <select name="tipo" className={inputCls} defaultValue="conciliacao">
        <option value="conciliacao">Conciliação</option>
        <option value="una">Una</option>
        <option value="instrucao">Instrução</option>
        <option value="outra">Outra</option>
      </select>
      <select name="modalidade" className={inputCls} defaultValue="presencial">
        <option value="presencial">Presencial</option>
        <option value="virtual">Virtual</option>
      </select>
      <input name="vara" className={inputCls} placeholder="Vara" />
      <input name="prepostoNome" className={inputCls} placeholder="Preposto (nome)" />
      <input name="prepostoWhatsapp" className={inputCls} placeholder="WhatsApp do preposto" />
    </Form>
  );
}

export function ParteForm({ processoId }: { processoId: string }) {
  return (
    <Form action={registrarParte} processoId={processoId} submitLabel="Registrar parte">
      <select name="papel" className={inputCls} defaultValue="reclamante">
        <option value="reclamante">Reclamante</option>
        <option value="reclamada">Reclamada</option>
        <option value="autor">Autor</option>
        <option value="reu">Réu</option>
        <option value="terceiro">Terceiro</option>
      </select>
      <input name="nome" className={inputCls} placeholder="Nome" />
      <input name="cpfCnpj" className={inputCls} placeholder="CPF/CNPJ" />
      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" name="ehPolo" /> É o polo
      </label>
    </Form>
  );
}
