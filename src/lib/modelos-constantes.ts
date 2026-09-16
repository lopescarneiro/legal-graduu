// Constantes/tipos de modelos — SEM "server-only": usados no client (form-builder)
// e no server (queries/actions).

export type TipoCampo = "text" | "textarea" | "date" | "numero" | "moeda" | "cpf_cnpj";

export type CampoModelo = {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  ajuda?: string;
};

export const TIPOS_CAMPO: { valor: TipoCampo; rotulo: string }[] = [
  { valor: "text", rotulo: "Texto curto" },
  { valor: "textarea", rotulo: "Texto longo" },
  { valor: "date", rotulo: "Data" },
  { valor: "numero", rotulo: "Número" },
  { valor: "moeda", rotulo: "Valor (R$)" },
  { valor: "cpf_cnpj", rotulo: "CPF / CNPJ" },
];

export const CATEGORIAS: { valor: string; rotulo: string }[] = [
  { valor: "funcionarios", rotulo: "Funcionários" },
  { valor: "fornecedores", rotulo: "Fornecedores" },
  { valor: "locacao", rotulo: "Locação" },
  { valor: "lgpd", rotulo: "LGPD" },
  { valor: "societario", rotulo: "Societário" },
  { valor: "outros", rotulo: "Outros" },
];

export function rotuloCategoria(valor: string): string {
  return CATEGORIAS.find((c) => c.valor === valor)?.rotulo ?? valor;
}
