"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm({ provider }: { provider: "dev" | "preview" }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    const r = await signIn(provider, { email, senha, redirect: false });
    setCarregando(false);
    if (r?.error) {
      setErro("Credenciais inválidas.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      <Field label="E-mail">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
      </Field>
      <Field label="Senha" error={erro ?? undefined}>
        <Input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          invalid={!!erro}
        />
      </Field>
      <Button type="submit" disabled={carregando} className="mt-1 w-full">
        {carregando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
