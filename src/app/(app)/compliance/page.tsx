import Link from "next/link";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    href: "/compliance/modelos",
    titulo: "Modelos",
    desc: "Peças cadastradas pelo escritório para o polo preencher e gerar.",
    ativo: true,
  },
  {
    href: "/compliance/repositorio",
    titulo: "Repositório",
    desc: "Documentos por categoria, com status e vencimento.",
    ativo: true,
  },
  { href: "#", titulo: "Avaliação por IA", desc: "Pendências e riscos dos documentos.", ativo: false },
];

export default function Compliance() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Compliance</h1>
        <p className="text-sm text-muted">Documentos, modelos e conformidade do polo.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CARDS.map((c) =>
          c.ativo ? (
            <Link
              key={c.titulo}
              href={c.href}
              className="rounded-[var(--r-card)] border border-line bg-card p-4 shadow-[var(--sh-sm)] hover:border-brand"
            >
              <div className="font-medium text-ink">{c.titulo}</div>
              <div className="text-xs text-muted">{c.desc}</div>
            </Link>
          ) : (
            <div key={c.titulo} className="rounded-[var(--r-card)] border border-dashed border-line2 p-4 text-muted">
              <div className="font-medium">{c.titulo}</div>
              <div className="text-xs">{c.desc}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide">Em breve</div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
