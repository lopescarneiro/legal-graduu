"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gavel,
  Clock,
  CalendarDays,
  FolderCheck,
  Video,
  MessageCircle,
  Building2,
  LogOut,
} from "lucide-react";
import { cn } from "@/components/ui";

const ITENS = [
  { href: "/", rotulo: "Painel", icon: LayoutDashboard },
  { href: "/processos", rotulo: "Processos", icon: Gavel },
  { href: "/prazos", rotulo: "Prazos", icon: Clock },
  { href: "/audiencias", rotulo: "Audiências", icon: CalendarDays },
  { href: "/compliance", rotulo: "Compliance", icon: FolderCheck },
  { href: "/reunioes", rotulo: "Reuniões", icon: Video },
  { href: "/consultas", rotulo: "Consultas", icon: MessageCircle },
];
const ESCRITORIO_ONLY = [{ href: "/clientes", rotulo: "Clientes", icon: Building2 }];

export function Nav({ escritorio, nome }: { escritorio: boolean; nome: string | null }) {
  const path = usePathname();
  const itens = escritorio ? [...ITENS, ...ESCRITORIO_ONLY] : ITENS;
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-card">
      <div className="px-5 py-5">
        <div className="text-lg font-bold tracking-tight text-brand">Legal Graduu</div>
        <div className="text-[11px] font-medium text-muted">Assessoria jurídica</div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {itens.map((i) => {
          const ativo = i.href === "/" ? path === "/" : path.startsWith(i.href);
          const Icon = i.icon;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--r)] px-3 py-2 text-sm font-medium transition",
                ativo
                  ? "bg-brand text-on-brand shadow-[var(--sh-sm)]"
                  : "text-ink2 hover:bg-canvas2 hover:text-ink",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={2} />
              {i.rotulo}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-line px-4 py-3">
        <div className="truncate text-xs font-medium text-ink2">{nome ?? "—"}</div>
        <a
          href="/sair"
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted transition hover:text-danger"
        >
          <LogOut className="size-3" /> Sair
        </a>
      </div>
    </aside>
  );
}
