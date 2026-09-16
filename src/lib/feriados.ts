/**
 * Feriados NACIONAIS do Brasil (fixos + móveis derivados da Páscoa).
 *
 * ⚠️ Escopo deliberado: aqui só entram os feriados nacionais. O MOTOR DE PRAZO
 * (Fase 1b) precisa, além destes, do RECESSO FORENSE (20/12–20/01, CPC art. 220),
 * de feriados ESTADUAIS/MUNICIPAIS e de SUSPENSÕES por comarca — que NÃO têm base
 * pública, estruturada e confiável. Por isso o motor devolve "prazo SUGERIDO,
 * confira" e, quando a comarca/calendário não é coberta, retorna baixa confiança
 * em vez de um número (nunca inferir prazo com calendário parcial). Ver
 * legal-graduu-mvp-spec.md §4.5 / revisão E3.
 */

/** Domingo de Páscoa (algoritmo de Meeus/Butcher) para um ano. */
function pascoa(ano: number): { mes: number; dia: number } {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

function iso(ano: number, mes: number, dia: number): string {
  const mm = String(mes).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

function addDiasISO(base: string, dias: number): string {
  const [a, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const cache = new Map<number, Set<string>>();

/** Conjunto de feriados nacionais (ISO 'YYYY-MM-DD') de um ano, memoizado. */
function feriadosNacionais(ano: number): Set<string> {
  const cached = cache.get(ano);
  if (cached) return cached;

  const fixos = [
    iso(ano, 1, 1), // Confraternização Universal
    iso(ano, 4, 21), // Tiradentes
    iso(ano, 5, 1), // Dia do Trabalho
    iso(ano, 9, 7), // Independência
    iso(ano, 10, 12), // Nossa Senhora Aparecida
    iso(ano, 11, 2), // Finados
    iso(ano, 11, 15), // Proclamação da República
    iso(ano, 11, 20), // Consciência Negra (nacional desde 2024 — Lei 14.759/2023)
    iso(ano, 12, 25), // Natal
  ];

  const p = pascoa(ano);
  const domingoPascoa = iso(ano, p.mes, p.dia);
  const moveis = [
    addDiasISO(domingoPascoa, -48), // Segunda de Carnaval
    addDiasISO(domingoPascoa, -47), // Terça de Carnaval
    addDiasISO(domingoPascoa, -2), // Sexta-feira Santa
    addDiasISO(domingoPascoa, 60), // Corpus Christi
  ];

  const set = new Set<string>([...fixos, ...moveis]);
  cache.set(ano, set);
  return set;
}

/** True se a data ISO 'YYYY-MM-DD' é feriado NACIONAL (fixo ou móvel). */
export function ehFeriado(isoDate: string): boolean {
  const ano = Number(isoDate.slice(0, 4));
  if (!Number.isFinite(ano)) return false;
  return feriadosNacionais(ano).has(isoDate);
}
