import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { modeloGeracoes } from "@/db/schema";
import { requireSessao, escopoClientes } from "@/lib/session";
import { obterModelo } from "@/lib/modelos";
import { formatDateTime } from "@/lib/dates";
import { PreencherForm } from "./preencher-form";

export const dynamic = "force-dynamic";

export default async function PreencherModelo({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSessao();
  const { id } = await params;
  const m = await obterModelo(id);
  if (!m || !m.ativo) notFound();

  const esc = escopoClientes(s);
  const semAcesso = !!esc && esc.length === 0;
  const geracoes = semAcesso
    ? []
    : await db
        .select()
        .from(modeloGeracoes)
        .where(
          and(
            eq(modeloGeracoes.modeloId, id),
            esc ? inArray(modeloGeracoes.clienteId, esc) : undefined,
          ),
        )
        .orderBy(desc(modeloGeracoes.criadoEm))
        .limit(10);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <a href="/compliance/modelos" className="text-xs text-[var(--brand)] hover:underline">
          ← Modelos
        </a>
        <h1 className="text-2xl font-semibold">{m.titulo}</h1>
        {m.descricao && <p className="text-sm opacity-70">{m.descricao}</p>}
      </div>

      <PreencherForm modeloId={m.id} campos={m.variaveis ?? []} />

      {geracoes.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Gerações recentes</span>
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 text-sm">
            {geracoes.map((g) => (
              <div key={g.id} className="px-4 py-2 text-xs opacity-70">
                {formatDateTime(g.criadoEm)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
