import { requireSessao, ehEscritorio } from "@/lib/session";
import { Nav } from "./_components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSessao();
  return (
    <div className="flex min-h-screen">
      <Nav escritorio={ehEscritorio(s)} nome={s.nome} />
      <div className="flex-1">
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
