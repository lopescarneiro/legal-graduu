import {
  format,
  parseISO,
  isValid,
  addMonths,
  addDays,
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ehFeriado } from "./feriados";

/** Data atual no formato ISO 'YYYY-MM-DD' (sem horário). */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Converte string ISO ou Date em Date; null se inválida. */
function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

/** Formata como 'dd/MM/yyyy'. */
export function formatDate(value?: string | Date | null): string {
  const d = toDate(value);
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "";
}

/** Formata como 'dd/MM/yyyy HH:mm'. */
export function formatDateTime(value?: string | Date | null): string {
  const d = toDate(value);
  return d ? format(d, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "";
}

/** Dias entre hoje e a data informada (negativo = atrasado). */
export function diasRestantes(vencimentoISO: string): number {
  const d = toDate(vencimentoISO);
  if (!d) return 0;
  const hoje = parseISO(todayISO());
  return differenceInCalendarDays(d, hoje);
}

/** Dia útil = não é fim de semana E não é feriado nacional (ver feriados.ts). */
export function ehDiaUtil(d: Date): boolean {
  return !isWeekend(d) && !ehFeriado(format(d, "yyyy-MM-dd"));
}

/** Data resultante de somar `dias` DIAS ÚTEIS a partir de `de`. Base do SLA (48h úteis ≈ 2 dias úteis). */
export function proximoDiaUtilApos(de: Date, dias: number): Date {
  const r = new Date(de);
  let restantes = Math.max(0, dias);
  while (restantes > 0) {
    r.setDate(r.getDate() + 1);
    if (ehDiaUtil(r)) restantes--;
  }
  return r;
}

/**
 * Dias ÚTEIS (seg–sex, descontando feriados nacionais) no mês de uma competência 'YYYY-MM'.
 */
export function diasUteisDoMes(competencia: string): number {
  const inicio = toDate(`${competencia}-01`);
  if (!inicio) return 0;
  return eachDayOfInterval({ start: startOfMonth(inicio), end: endOfMonth(inicio) }).filter(
    ehDiaUtil,
  ).length;
}

export { addMonths, addDays, parseISO, format, differenceInCalendarDays };
