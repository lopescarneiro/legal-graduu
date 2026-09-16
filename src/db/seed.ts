import { db, closeDb } from "./index";
import { clientes, modelos, funis, funilEtapas } from "./schema";

/** Seed de desenvolvimento: cliente demo + modelo exemplo + os 3 funis. Idempotente. */
const DEMO_CLIENTE_ID = "11111111-1111-4111-8111-111111111111";

const CORES = [
  "#7c3aed", "#2563eb", "#0891b2", "#16a34a", "#ca8a04",
  "#dc2626", "#9333ea", "#0d9488", "#e11d48", "#475569", "#334155",
];

const FUNIS_DEF = [
  {
    tipo: "processo_trabalhista" as const,
    nome: "Trabalhista",
    ehPadrao: true,
    etapas: [
      { chave: "citacao", nome: "Citação/notificação" },
      { chave: "triagem", nome: "Triagem e risco" },
      { chave: "defesa", nome: "Defesa em elaboração" },
      { chave: "audiencia", nome: "Audiência inicial/una" },
      { chave: "instrucao", nome: "Instrução" },
      { chave: "sentenca", nome: "Sentença" },
      { chave: "recurso", nome: "Recurso (RO/TST)" },
      { chave: "liquidacao", nome: "Liquidação" },
      { chave: "execucao", nome: "Execução" },
      { chave: "encerrado", nome: "Encerrado", terminal: true },
    ],
  },
  {
    tipo: "processo_civel" as const,
    nome: "Cível empresarial",
    etapas: [
      { chave: "citacao", nome: "Citação" },
      { chave: "triagem", nome: "Triagem e risco" },
      { chave: "conciliacao", nome: "Conciliação (art. 334)" },
      { chave: "contestacao", nome: "Contestação/Réplica" },
      { chave: "saneamento", nome: "Saneamento (art. 357)" },
      { chave: "instrucao", nome: "Instrução" },
      { chave: "sentenca", nome: "Sentença" },
      { chave: "apelacao", nome: "Apelação" },
      { chave: "transito", nome: "Trânsito em julgado" },
      { chave: "cumprimento", nome: "Cumprimento/Execução" },
      { chave: "encerrado", nome: "Encerrado", terminal: true },
    ],
  },
  {
    tipo: "processo_consumidor" as const,
    nome: "Consumidor (Juizados)",
    etapas: [
      { chave: "citacao", nome: "Citação" },
      { chave: "triagem", nome: "Triagem e risco" },
      { chave: "conciliacao", nome: "Conciliação (JEC)" },
      { chave: "instrucao", nome: "Contestação + Instrução e Julgamento" },
      { chave: "sentenca", nome: "Sentença" },
      { chave: "recurso", nome: "Recurso Inominado" },
      { chave: "cumprimento", nome: "Cumprimento" },
      { chave: "encerrado", nome: "Encerrado", terminal: true },
    ],
  },
];

async function main() {
  await db
    .insert(clientes)
    .values({ id: DEMO_CLIENTE_ID, nome: "Polo Demonstração", cnpj: "00.000.000/0001-00", status: "ativo" })
    .onConflictDoNothing();

  const temModelo = await db.select({ id: modelos.id }).from(modelos).limit(1);
  if (temModelo.length === 0) {
    await db.insert(modelos).values({
      titulo: "Notificação de advertência",
      categoria: "funcionarios",
      descricao: "Advertência disciplinar a funcionário do polo.",
      corpo:
        "ADVERTÊNCIA\n\nAo(À) Sr(a). {{nome_funcionario}}, portador(a) do CPF {{cpf}}, na função de {{funcao}}.\n\nComunicamos a aplicação de advertência em razão de: {{motivo}}.\n\nData: {{data}}.\n\n_______________________\nPolo (empregador)",
      variaveis: [
        { chave: "nome_funcionario", rotulo: "Nome do funcionário", tipo: "text", obrigatorio: true },
        { chave: "cpf", rotulo: "CPF", tipo: "cpf_cnpj", obrigatorio: true },
        { chave: "funcao", rotulo: "Função", tipo: "text", obrigatorio: false },
        { chave: "motivo", rotulo: "Motivo", tipo: "textarea", obrigatorio: true },
        { chave: "data", rotulo: "Data", tipo: "date", obrigatorio: true },
      ],
    });
  }

  const temFunil = await db.select({ id: funis.id }).from(funis).limit(1);
  if (temFunil.length === 0) {
    for (const [i, f] of FUNIS_DEF.entries()) {
      const [row] = await db
        .insert(funis)
        .values({ tipo: f.tipo, nome: f.nome, ehPadrao: !!f.ehPadrao, ordem: i })
        .returning({ id: funis.id });
      await db.insert(funilEtapas).values(
        f.etapas.map((e, j) => ({
          funilId: row.id,
          chave: e.chave,
          nome: e.nome,
          cor: CORES[j % CORES.length],
          ordem: j,
          ehTerminal: !!(e as { terminal?: boolean }).terminal,
        })),
      );
    }
  }

  await closeDb();
  // eslint-disable-next-line no-console
  console.log("seed ok");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
