"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Painel" },
  { href: "/processos", rotulo: "Processos" },
  { href: "/prazos", rotulo: "Prazos" },
  { href: "/audiencias", rotulo: "Audiências" },
  { href: "/compliance", rotulo: "Compliance" },
  { href: "/reunioes", rotulo: "Reuniões" },
  { href: "/consultas", rotulo: "Consultas" },
];
const ESCRITORIO_ONLY = [{ href: "/clientes", rotulo: "Clientes" }];

export function Nav({ escritorio, nome }: { escritorio: boolean; nome: string | null }) {
  const path = usePathname();
  const itens = escritorio ? [...ITENS, ...ESCRITORIO_ONLY] : ITENS;
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-black/10">
      <div className="px-4 py-4 text-lg font-semibold text-[var(--brand)]">Legal Graduu</div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {itens.map((i) => {
          const ativo = i.href === "/" ? path === "/" : path.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={
                "rounded-md px-3 py-2 text-sm " +
                (ativo ? "bg-[var(--brand)] text-white" : "hover:bg-black/5")
              }
            >
              {i.rotulo}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-black/10 px-4 py-3 text-xs">
        <div className="truncate opacity-70">{nome ?? "—"}</div>
        <a href="/sair" className="mt-1 inline-block text-[var(--brand)] hover:underline">
          Sair
        </a>
      </div>
    </aside>
  );
}
