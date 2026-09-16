import "server-only";

/**
 * Envio de WhatsApp via Atende (S2S). Best-effort: sem `ATENDE_API_URL`/`ATENDE_API_SECRET`
 * (ou sem telefone) → no-op, retorna false. O contrato exato do endpoint do Atende deve
 * ser confirmado ao ligar de verdade — aqui é o esqueleto que a operação de prazos usa.
 */
export async function enviarWhatsapp(
  telefone: string | null | undefined,
  texto: string,
): Promise<boolean> {
  const base = process.env.ATENDE_API_URL;
  const secret = process.env.ATENDE_API_SECRET;
  if (!base || !secret || !telefone) return false;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/integracoes/enviar`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-atende-secret": secret },
      body: JSON.stringify({ telefone, texto }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
