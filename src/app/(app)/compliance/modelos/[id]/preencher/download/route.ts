import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { modeloGeracoes, modelos } from "@/db/schema";
import { getSessao, escopoClientes } from "@/lib/session";
import { registrarAudit } from "@/lib/audit";
import {
  gerarArquivo,
  slugArquivo,
  FORMATO_MIME,
  type FormatoExport,
} from "@/lib/documento-export";

export const dynamic = "force-dynamic";

/**
 * Baixa uma geração de documento como .docx ou .pdf. Cercado pelo escopo de
 * clientes da sessão (fail-closed) e auditado como download.
 * GET .../preencher/download?g=<geracaoId>&fmt=docx|pdf
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const s = await getSessao();
  if (!s) return new NextResponse("Não autenticado.", { status: 401 });

  const { id: modeloId } = await params;
  const sp = req.nextUrl.searchParams;
  const geracaoId = sp.get("g") ?? "";
  const fmt = (sp.get("fmt") ?? "docx") as FormatoExport;
  if (fmt !== "docx" && fmt !== "pdf") {
    return new NextResponse("Formato inválido.", { status: 400 });
  }
  if (!geracaoId) return new NextResponse("Geração não informada.", { status: 400 });

  const esc = escopoClientes(s);
  if (esc && esc.length === 0) return new NextResponse("Sem acesso.", { status: 403 });

  const [g] = await db
    .select()
    .from(modeloGeracoes)
    .where(
      and(
        eq(modeloGeracoes.id, geracaoId),
        eq(modeloGeracoes.modeloId, modeloId),
        esc ? inArray(modeloGeracoes.clienteId, esc) : undefined,
      ),
    )
    .limit(1);
  if (!g) return new NextResponse("Geração não encontrada.", { status: 404 });

  const [m] = await db
    .select({ titulo: modelos.titulo })
    .from(modelos)
    .where(eq(modelos.id, modeloId))
    .limit(1);
  const titulo = m?.titulo ?? "Documento";
  const corpo = g.conteudoGerado ?? "";

  const bytes = await gerarArquivo(fmt, titulo, corpo);
  const data = new Date(g.criadoEm);
  const carimbo = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;
  const nome = `${slugArquivo(titulo)}-${carimbo}.${fmt}`;

  await registrarAudit({
    acao: "download",
    entidade: "modelo_geracao",
    entidadeId: g.id,
    clienteId: g.clienteId,
    atorId: s.id,
    atorPapel: s.escritorio ? "escritorio" : "polo",
    ip: req.headers.get("x-forwarded-for"),
    detalhe: { modelo: titulo, formato: fmt },
  });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": FORMATO_MIME[fmt],
      "Content-Disposition": `attachment; filename="${slugArquivo(titulo)}.${fmt}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "no-store",
    },
  });
}
