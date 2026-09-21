import { requireEscritorio } from "@/lib/session";
import { listarClientesCompleto } from "@/lib/clientes";
import { ClientesAdmin, type ClienteRow } from "./_components/clientes-admin";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  // Carteira de polos — só o escritório (polo é redirecionado para "/").
  await requireEscritorio();
  const lista = await listarClientesCompleto();
  const clientes: ClienteRow[] = lista.map((c) => ({
    id: c.id,
    nome: c.nome,
    cnpj: c.cnpj,
    telefone: c.telefone,
    status: c.status,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Clientes</h1>
        <p className="text-sm text-muted">
          Carteira de polos assinantes. O telefone é usado nos lembretes de prazo (WhatsApp).
        </p>
      </div>
      <ClientesAdmin clientes={clientes} />
    </div>
  );
}
