"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

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
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-mail"
        className="rounded-md border px-3 py-2 text-sm"
        autoComplete="username"
      />
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha"
        className="rounded-md border px-3 py-2 text-sm"
        autoComplete="current-password"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit"
        disabled={carregando}
        className="rounded-md bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {carregando ? "Entrando…" : "Entrar (dev)"}
      </button>
    </form>
  );
}
