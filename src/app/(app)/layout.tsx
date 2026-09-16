import { requireSessao, ehEscritorio } from "@/lib/session";
import { Nav } from "./_components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSessao();
  return (
    <div className="flex min-h-screen bg-bg">
      <Nav escritorio={ehEscritorio(s)} nome={s.nome} />
      <div className="flex-1 overflow-x-hidden">
        <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
