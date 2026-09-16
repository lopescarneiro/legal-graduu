// Constantes/tipos de funil — client-safe (sem "server-only").

export type Ramo = "trabalhista" | "civel" | "consumidor";

export const RAMOS: { valor: Ramo; rotulo: string }[] = [
  { valor: "trabalhista", rotulo: "Trabalhista" },
  { valor: "civel", rotulo: "Cível empresarial" },
  { valor: "consumidor", rotulo: "Consumidor" },
];

export const TIPO_FUNIL_POR_RAMO = {
  trabalhista: "processo_trabalhista",
  civel: "processo_civel",
  consumidor: "processo_consumidor",
} as const;

export function rotuloRamo(r: string): string {
  return RAMOS.find((x) => x.valor === r)?.rotulo ?? r;
}

/** Etapa interna do funil → status simplificado para o POLO (visão humanizada). */
export function statusHumanizado(chave: string | null): string {
  switch (chave) {
    case "citacao":
    case "triagem":
      return "Em análise";
    case "defesa":
    case "contestacao":
    case "conciliacao":
    case "saneamento":
      return "Defesa protocolada";
    case "instrucao":
    case "sentenca":
      return "Em andamento";
    case "recurso":
    case "apelacao":
      return "Recurso em curso";
    case "liquidacao":
    case "cumprimento":
    case "execucao":
    case "transito":
      return "Execução/Cumprimento";
    case "encerrado":
      return "Encerrado";
    default:
      return "Em andamento";
  }
}
