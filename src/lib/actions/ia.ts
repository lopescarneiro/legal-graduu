"use server";

import { requireSessao, somenteLeitura } from "@/lib/session";
import { extrairCitacao, iaConfigurada, type CitacaoExtraida } from "@/lib/ia";
import { registrarAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/result";

const TIPOS_OK = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Analisa uma citação (PDF/imagem) com IA e devolve os dados extraídos para
 * pré-preencher o intake. Não persiste nada — a criação do processo é um passo
 * humano à parte. Falha RUIDOSA (devolve a mensagem de erro).
 */
export async function analisarCitacao(
  formData: FormData,
): Promise<ActionResult & { dados?: CitacaoExtraida }> {
  const sessao = await requireSessao();
  if (somenteLeitura(sessao)) return { ok: false, error: "Sessão somente leitura." };
  if (!iaConfigurada()) {
    return { ok: false, error: "Análise por IA indisponível (chave não configurada)." };
  }

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione o arquivo da citação (PDF ou imagem)." };
  }
  if (!TIPOS_OK.has(file.type)) {
    return { ok: false, error: "Formato não suportado. Envie PDF, JPG, PNG ou WebP." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Arquivo muito grande (máx. 15 MB)." };
  }

  try {
    const dados = await extrairCitacao(file);
    await registrarAudit({
      acao: "view",
      entidade: "ia_extracao_citacao",
      clienteId: sessao.clienteId,
      atorId: sessao.id,
      atorPapel: sessao.escritorio ? "escritorio" : "polo",
      detalhe: { ramo: dados.ramo, temPrazo: dados.prazo != null, partes: dados.partes.length },
    });
    return { ok: true, dados };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao analisar a citação.";
    return { ok: false, error: msg };
  }
}
