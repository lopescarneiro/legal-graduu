"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { criarConsulta } from "@/lib/actions/consultas";
import { Field, Button, inputClasses, cn } from "@/components/ui";

const inputCls = inputClasses;

export function NovaConsultaForm({
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
    const r = await criarConsulta(new FormData(e.currentTarget));
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setOk(r.message ?? "Enviada.");
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-[var(--r-card)] border border-line bg-card p-4 shadow-[var(--sh-sm)]"
    >
      {escritorio && (
        <Field label="Cliente">
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
      <Field label="Assunto">
        <input name="assunto" className={inputCls} placeholder="Resumo da dúvida" />
      </Field>
      <Field label="Pergunta">
        <textarea name="pergunta" className={cn(inputCls, "h-auto min-h-24 py-2")} />
      </Field>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      {ok && <p className="text-sm text-success">{ok}</p>}
      <Button type="submit" disabled={enviando} className="self-start">
        {enviando ? "Enviando…" : "Enviar consulta"}
      </Button>
    </form>
  );
}
