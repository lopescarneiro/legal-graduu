import type { Metadata } from "next";

export const metadata: Metadata = { title: "Em manutenção — Legal Graduu" };

// Estática e pública: é o destino do rewrite do proxy quando a manutenção liga.
export const dynamic = "force-static";

export default function Manutencao() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md text-center">
        <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand">
          Legal Graduu
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Em manutenção</h1>
        <p className="mt-2 text-sm text-muted">
          Estamos fazendo uma atualização rápida na plataforma. Volte em alguns minutos — seus dados
          estão seguros.
        </p>
      </div>
    </main>
  );
}
