import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documentos, processos } from "@/db/schema";
import { getSessao, escopoClientes, ehEscritorio } from "@/lib/session";
import { lerArquivo } from "@/lib/storage";
import { registrarAudit, registrarAuditEstrito } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download autenticado, cercado por cliente + sigilo, e AUDITADO. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSessao();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const [doc] = await db.select().from(documentos).where(eq(documentos.id, id)).limit(1);
  if (!doc || !doc.arquivoPath) return NextResponse.json({ ok: false }, { status: 404 });

  // Cerca por cliente (escritório = sem restrição; polo = só o seu; vazio = nada).
  const esc = escopoClientes(s);
  if (esc && !esc.includes(doc.clienteId)) return NextResponse.json({ ok: false }, { status: 403 });
  // Segredo de justiça: só o escritório baixa.
  if (doc.sigilo === "segredo_justica" && !ehEscritorio(s)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  // Peça de processo em segredo de justiça herda a restrição do processo.
  if (doc.processoId && !ehEscritorio(s)) {
    const [proc] = await db
      .select({ segredoJustica: processos.segredoJustica })
      .from(processos)
      .where(eq(processos.id, doc.processoId))
      .limit(1);
    if (proc?.segredoJustica) return NextResponse.json({ ok: false }, { status: 403 });
  }

  let bytes: Buffer;
  try {
    bytes = await lerArquivo(doc.arquivoPath);
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const evento = {
    acao: "download" as const,
    entidade: "documento",
    entidadeId: doc.id,
    clienteId: doc.clienteId,
    atorId: s.id,
    atorPapel: ehEscritorio(s) ? "escritorio" : "polo",
    ip: req.headers.get("x-forwarded-for"),
    detalhe: { nome: doc.nome, sigilo: doc.sigilo },
  };
  // Documento sensível/sigiloso: auditoria FAIL-CLOSED (se não gravar, não serve).
  if (doc.sigilo !== "normal" || doc.contemDadosSensiveis) {
    try {
      await registrarAuditEstrito(evento);
    } catch {
      return NextResponse.json({ ok: false, error: "auditoria_indisponivel" }, { status: 503 });
    }
  } else {
    await registrarAudit(evento);
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": doc.mime || "application/octet-stream",
      "content-disposition": `attachment; filename="${encodeURIComponent(doc.nome)}"`,
    },
  });
}
