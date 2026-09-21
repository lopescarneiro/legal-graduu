/**
 * Dinheiro no sistema é SEMPRE armazenado e manipulado em CENTAVOS (inteiro).
 * Nunca use float para valores monetários. Estas funções fazem a ponte com a UI.
 */

/** Formata centavos como moeda brasileira, ex.: 123456 -> "R$ 1.234,56". */
export function formatBRL(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Formata centavos sem o símbolo, ex.: 123456 -> "1.234,56". */
export function formatNumber(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte um texto digitado pelo usuário em centavos.
 * Aceita "1.234,56", "1234,56", "1234.56", "1.500", "R$ 1.234,56" e retorna centavos.
 * Retorna null quando não consegue interpretar.
 *
 * Regra do ponto sem vírgula (pt-BR): "1.500" e "1.234.567" são MILHAR, não decimal.
 * Só tratamos o ponto como decimal quando há exatamente 2 dígitos após um único ponto
 * (ex.: "1234.56") — o caso típico de quem digitou no padrão internacional.
 */
export function parseBRLToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  let s = input.trim();
  if (!s) return null;
  s = s.replace(/[R$\s]/g, "");
  if (s.includes(",")) {
    // vírgula = decimal; pontos = milhar
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(".")) {
    const partes = s.split(".");
    const ultima = partes[partes.length - 1];
    // >1 ponto OU último grupo != 2 dígitos ⇒ pontos são separador de milhar.
    if (partes.length > 2 || ultima.length !== 2) {
      s = partes.join("");
    }
    // senão: mantém como decimal (ex.: "1234.56").
  }
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Centavos -> número em reais (para inputs controlados). */
export function centsToReais(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}

/** Reais (number) -> centavos (inteiro). */
export function reaisToCents(reais: number | null | undefined): number {
  return Math.round((reais ?? 0) * 100);
}
