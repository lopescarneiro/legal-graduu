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
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56" e retorna 123456.
 * Retorna null quando não consegue interpretar.
 */
export function parseBRLToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  let s = input.trim();
  if (!s) return null;
  s = s.replace(/[R$\s ]/g, "");
  if (s.includes(",") && s.includes(".")) {
    // pt-BR: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
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
