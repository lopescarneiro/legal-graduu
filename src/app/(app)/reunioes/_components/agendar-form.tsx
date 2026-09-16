"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { agendarReuniao } from "@/lib/actions/reunioes";
import { Field, Button, inputClasses } from "@/components/ui";

const inputCls = inputClasses;

export function AgendarForm({
  escritorio,
  clientes,
}: {
  escritorio: boolean;
  clientes: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    setOk(null);
    const r = await agendarReuniao(new FormData(e.currentTarget));
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setOk(r.message ?? "Agendada.");
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 rounded-[var(--r-card)] border border-line bg-card p-4 shadow-[var(--sh-sm)] sm:grid-cols-2"
    >
      {escritorio && (
        <Field label="Cliente" className="sm:col-span-2">
          <select name="clienteId" className={inputCls} required defaultValue="">
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
      )}
      <Field label="Data e hora">
        <input name="dataHora" type="datetime-local" className={inputCls} required />
      </Field>
      <Field label="Assunto (opcional)">
        <input name="tipo" className={inputCls} placeholder="Ex.: Revisão de contratos" />
      </Field>
      <Field label="Link da reunião (opcional)" className="sm:col-span-2">
        <input name="link" className={inputCls} placeholder="https://…" />
      </Field>
      {erro && <p className="text-sm text-danger sm:col-span-2">{erro}</p>}
      {ok && <p className="text-sm text-success sm:col-span-2">{ok}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Agendando…" : "Agendar reunião"}
        </Button>
      </div>
    </form>
  );
}
