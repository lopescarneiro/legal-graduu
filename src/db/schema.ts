/**
 * Schema do Legal Graduu (Postgres — Drizzle, schema-first via `drizzle-kit push`).
 *
 * Regras de ouro da suíte: dinheiro em CENTAVOS (integer), datas de negócio como
 * string 'YYYY-MM-DD' (`date(..., { mode: "string" })`), cerca multi-tenant por
 * `clienteId` (id global do Hub = tenant do polo). Ao criar tabela `public` nova:
 * LIGAR RLS no Supabase.
 *
 * Cerca: toda query de dado de cliente é cercada por `clienteId` via
 * `escopoClientes()` (src/lib/session.ts): escritório = sem restrição, polo = só o
 * seu, vazio = nada (fail-closed). As DEFINIÇÕES de pipeline (`funis`/`funil_etapas`)
 * são globais da operação do escritório (sem clienteId).
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { CampoModelo } from "@/lib/modelos-constantes";

// ===========================================================================
// Auditoria (transversal) — imutável (append-only + hash-chain no Supabase).
// ===========================================================================
export const acaoAuditoriaEnum = pgEnum("acao_auditoria", [
  "view",
  "download",
  "write",
  "delete",
  "login",
  "export",
]);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    clienteId: uuid("cliente_id"),
    atorId: uuid("ator_id"),
    atorPapel: text("ator_papel"),
    ip: text("ip"),
    acao: acaoAuditoriaEnum("acao").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: text("entidade_id"),
    detalhe: jsonb("detalhe").$type<Record<string, unknown>>(),
    prevHash: text("prev_hash"),
    hash: text("hash"),
  },
  (t) => [
    index("idx_audit_cliente_data").on(t.clienteId, t.criadoEm),
    index("idx_audit_entidade").on(t.entidade, t.entidadeId),
  ],
);

// ===========================================================================
// Clientes (tenants) — o polo assinante. `id` = org global do Hub (== sessão.clienteId).
// ===========================================================================
export const statusClienteEnum = pgEnum("status_cliente", ["ativo", "inadimplente", "inativo"]);

export const clientes = pgTable("clientes", {
  id: uuid("id").primaryKey(), // = Hub org global id
  nome: text("nome").notNull(),
  cnpj: text("cnpj"),
  telefone: text("telefone"), // contato p/ lembretes (WhatsApp via Atende)
  status: statusClienteEnum("status").notNull().default("ativo"),
  // Cobrança em nome do ESCRITÓRIO (Modelo B): a conta Asaas fica no Hub/integracoes;
  // aqui só um flag de que o cliente tem cobrança configurada.
  cobrancaConfigurada: boolean("cobranca_configurada").notNull().default(false),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

// ===========================================================================
// COMPLIANCE (Fase 1a) — repositório documental + modelos + avaliação IA advisory.
// ===========================================================================
export const categoriaDocumentoEnum = pgEnum("categoria_documento", [
  "funcionarios",
  "fornecedores",
  "locacao",
  "lgpd",
  "societario",
  "processo",
  "outros",
]);
export const statusDocumentoEnum = pgEnum("status_documento", [
  "em_dia",
  "a_vencer",
  "pendente",
  "nao_avaliado",
]);
export const sigiloEnum = pgEnum("sigilo", ["normal", "sensivel", "segredo_justica"]);
export const origemUploadEnum = pgEnum("origem_upload", ["polo", "escritorio"]);

/** Repositório único: documentos do Compliance E peças de processo (processoId != null). */
export const documentos = pgTable(
  "documentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id").notNull(),
    processoId: uuid("processo_id"), // != null → peça de processo
    categoria: categoriaDocumentoEnum("categoria").notNull().default("outros"),
    tipoPeca: text("tipo_peca"), // citacao|contestacao|recurso|laudo|sentenca|prova (quando peça)
    nome: text("nome").notNull(),
    // Storage: bucket PRIVADO; download só por URL assinada de curta duração.
    arquivoPath: text("arquivo_path"),
    mime: text("mime"),
    tamanhoBytes: integer("tamanho_bytes"),
    versao: integer("versao").notNull().default(1),
    status: statusDocumentoEnum("status").notNull().default("nao_avaliado"),
    sigilo: sigiloEnum("sigilo").notNull().default("normal"),
    contemDadosSensiveis: boolean("contem_dados_sensiveis").notNull().default(false),
    vencimentoEm: date("vencimento_em", { mode: "string" }),
    uploadedByTipo: origemUploadEnum("uploaded_by_tipo"),
    uploadedById: uuid("uploaded_by_id"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_documentos_cliente_cat").on(t.clienteId, t.categoria),
    index("idx_documentos_processo").on(t.processoId),
  ],
);

/** Avaliação por IA — ADVISORY: nunca marca "em_dia" sozinha; falha vira "revisar". */
export const avaliacaoIaStatusEnum = pgEnum("avaliacao_ia_status", ["ok", "revisar", "falhou"]);
export const documentoAvaliacoes = pgTable(
  "documento_avaliacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentoId: uuid("documento_id")
      .notNull()
      .references(() => documentos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
    resumo: text("resumo"),
    pendencias: jsonb("pendencias").$type<string[]>(),
    riscos: jsonb("riscos").$type<string[]>(),
    score: integer("score"), // 0-100
    status: avaliacaoIaStatusEnum("status").notNull().default("revisar"),
    validadoPorId: uuid("validado_por_id"),
    validadoEm: timestamp("validado_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_avaliacoes_documento").on(t.documentoId)],
);

/** Biblioteca de modelos — autorada pelo ESCRITÓRIO, global (sem clienteId). */
export const modelos = pgTable("modelos", {
  id: uuid("id").primaryKey().defaultRandom(),
  titulo: text("titulo").notNull(),
  categoria: categoriaDocumentoEnum("categoria").notNull().default("outros"),
  descricao: text("descricao"),
  corpo: text("corpo").notNull(), // texto com {{chave}} substituído no preenchimento
  // Campos que o POLO preenche (form data-driven). tipo: text|textarea|date|numero|moeda|cpf_cnpj.
  variaveis: jsonb("variaveis").$type<CampoModelo[]>(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const modeloGeracoes = pgTable(
  "modelo_geracoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modeloId: uuid("modelo_id")
      .notNull()
      .references(() => modelos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id"), // null = preview do escritório (não vinculado a cliente)
    valores: jsonb("valores").$type<Record<string, string>>(),
    conteudoGerado: text("conteudo_gerado"),
    documentoId: uuid("documento_id").references(() => documentos.id, { onDelete: "set null" }),
    criadoPorId: uuid("criado_por_id"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_geracoes_cliente").on(t.clienteId)],
);

// ===========================================================================
// REUNIÕES + CONSULTAS (Fase 1a)
// ===========================================================================
export const statusReuniaoEnum = pgEnum("status_reuniao", ["agendada", "realizada", "cancelada"]);
export const reunioes = pgTable(
  "reunioes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id").notNull(),
    dataHora: timestamp("data_hora", { withTimezone: true }).notNull(),
    competencia: text("competencia"), // 'YYYY-MM' — p/ a regra "2/mês não cumulativo"
    tipo: text("tipo"),
    status: statusReuniaoEnum("status").notNull().default("agendada"),
    link: text("link"),
    observacoes: text("observacoes"),
    lembreteEnviado: boolean("lembrete_enviado").notNull().default(false),
    agendadaPorId: uuid("agendada_por_id"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_reunioes_cliente").on(t.clienteId, t.dataHora)],
);

export const statusConsultaEnum = pgEnum("status_consulta", ["aberta", "respondida", "encerrada"]);
export const consultas = pgTable(
  "consultas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id").notNull(),
    criadaPorId: uuid("criada_por_id"),
    assunto: text("assunto").notNull(),
    pergunta: text("pergunta").notNull(),
    status: statusConsultaEnum("status").notNull().default("aberta"),
    slaVenceEm: timestamp("sla_vence_em", { withTimezone: true }), // 48h úteis
    resposta: text("resposta"),
    respondidaPorId: uuid("respondida_por_id"),
    respondidaEm: timestamp("respondida_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_consultas_cliente").on(t.clienteId, t.status)],
);

// ===========================================================================
// FUNIL (Fase 1b) — portado do matriculador. Definições GLOBAIS do escritório.
// ===========================================================================
export const funilTipoEnum = pgEnum("funil_tipo", [
  "processo_trabalhista",
  "processo_civel",
  "processo_consumidor",
]);

export const funis = pgTable("funis", {
  id: uuid("id").primaryKey().defaultRandom(),
  tipo: funilTipoEnum("tipo").notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  ehPadrao: boolean("eh_padrao").notNull().default(false),
  ativo: boolean("ativo").notNull().default(true),
  ordem: integer("ordem").notNull().default(0),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const funilEtapas = pgTable(
  "funil_etapas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    funilId: uuid("funil_id")
      .notNull()
      .references(() => funis.id, { onDelete: "cascade" }),
    chave: text("chave").notNull(),
    nome: text("nome").notNull(),
    cor: text("cor").notNull().default("#64748b"),
    ordem: integer("ordem").notNull().default(0),
    ehTerminal: boolean("eh_terminal").notNull().default(false),
    slaDias: integer("sla_dias"),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_funil_etapa_chave").on(t.funilId, t.chave)],
);

export const funilInscricoes = pgTable(
  "funil_inscricoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    funilId: uuid("funil_id")
      .notNull()
      .references(() => funis.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
    entidade: text("entidade").notNull().default("processo"),
    entidadeId: uuid("entidade_id").notNull(),
    etapaId: uuid("etapa_id").references(() => funilEtapas.id, { onDelete: "set null" }),
    etapaDesde: timestamp("etapa_desde", { withTimezone: true }).notNull().defaultNow(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_funil_inscricao").on(t.funilId, t.entidadeId)],
);

export const funilHistorico = pgTable(
  "funil_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id").notNull(),
    entidade: text("entidade").notNull().default("processo"),
    entidadeId: uuid("entidade_id").notNull(),
    funilId: uuid("funil_id").references(() => funis.id, { onDelete: "cascade" }),
    deEtapaId: uuid("de_etapa_id"),
    paraEtapaId: uuid("para_etapa_id"),
    origem: text("origem").notNull().default("manual"), // manual|auto|seed
    usuarioId: uuid("usuario_id"),
    obs: text("obs"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_funil_historico_entidade").on(t.entidadeId)],
);

// ===========================================================================
// PROCESSOS (Fase 1b)
// ===========================================================================
export const ramoEnum = pgEnum("ramo_processo", ["trabalhista", "civel", "consumidor"]);
export const papelPoloEnum = pgEnum("papel_polo", ["reu", "autor", "terceiro"]);
export const faseMacroEnum = pgEnum("fase_macro", ["conhecimento", "recursal", "execucao"]);
export const situacaoProcessoEnum = pgEnum("situacao_processo", [
  "ativo",
  "suspenso",
  "encerrado",
  "arquivado",
]);
export const baseLegalEnum = pgEnum("base_legal", [
  "execucao_contrato",
  "exercicio_direitos",
  "obrigacao_legal",
  "legitimo_interesse",
]);

export const processos = pgTable(
  "processos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id").notNull(),
    numeroCnj: text("numero_cnj"), // null = "CNJ pendente"
    ramo: ramoEnum("ramo").notNull(),
    tipoAcao: text("tipo_acao"),
    tipoCausa: text("tipo_causa"), // taxonomia (subtipo)
    rito: text("rito"),
    tribunal: text("tribunal"),
    vara: text("vara"),
    comarca: text("comarca"),
    papelDoPolo: papelPoloEnum("papel_do_polo").notNull().default("reu"),
    valorCausaCents: integer("valor_causa_cents"),
    estagioAtualId: uuid("estagio_atual_id").references(() => funilEtapas.id, {
      onDelete: "set null",
    }),
    faseMacro: faseMacroEnum("fase_macro").notNull().default("conhecimento"),
    situacao: situacaoProcessoEnum("situacao").notNull().default("ativo"),
    dataCitacao: date("data_citacao", { mode: "string" }),
    dataDistribuicao: date("data_distribuicao", { mode: "string" }),
    advogadoResponsavelId: uuid("advogado_responsavel_id"),
    // LGPD/sigilo
    segredoJustica: boolean("segredo_justica").notNull().default(false),
    hipoteseSegredo: text("hipotese_segredo"),
    dadosSensiveis: boolean("dados_sensiveis").notNull().default(false),
    baseLegal: baseLegalEnum("base_legal"),
    finalidade: text("finalidade"),
    resumoHumanizado: text("resumo_humanizado"),
    // Intake por IA: rascunho pendente de confirmação humana.
    pendenteConfirmacao: boolean("pendente_confirmacao").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_processos_cliente").on(t.clienteId),
    index("idx_processos_cnj").on(t.numeroCnj),
    index("idx_processos_ramo").on(t.ramo),
  ],
);

export const partes = pgTable(
  "partes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id")
      .notNull()
      .references(() => processos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
    papel: text("papel").notNull(), // autor|reu|reclamante|reclamada|terceiro
    nome: text("nome").notNull(),
    cpfCnpj: text("cpf_cnpj"),
    poloAtivoPassivo: text("polo_ativo_passivo"),
    advogadoAdverso: text("advogado_adverso"),
    oab: text("oab"),
    ehPolo: boolean("eh_polo").notNull().default(false),
  },
  (t) => [index("idx_partes_processo").on(t.processoId)],
);

export const origemAndamentoEnum = pgEnum("origem_andamento", [
  "manual",
  "captura_djen",
  "datajud",
  "intimacao",
]);
export const andamentos = pgTable(
  "andamentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id")
      .notNull()
      .references(() => processos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
    data: date("data", { mode: "string" }).notNull(),
    descricao: text("descricao").notNull(),
    origem: origemAndamentoEnum("origem").notNull().default("manual"),
    codigoTpu: text("codigo_tpu"),
    documentoId: uuid("documento_id"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_andamentos_processo").on(t.processoId, t.data)],
);

// PRAZO — entidade de 1ª classe. Contrato de confiança + validação humana AUDITADA.
export const tipoPrazoEnum = pgEnum("tipo_prazo", ["fatal_peremptorio", "dilatorio"]);
export const contagemPrazoEnum = pgEnum("contagem_prazo", ["uteis", "corridos"]);
export const statusPrazoEnum = pgEnum("status_prazo", [
  "a_calcular",
  "aberto",
  "cumprido",
  "perdido",
]);
export const meioComunicacaoEnum = pgEnum("meio_comunicacao", ["djen", "domicilio", "oficial"]);

export const prazos = pgTable(
  "prazos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id")
      .notNull()
      .references(() => processos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
    tipo: tipoPrazoEnum("tipo").notNull().default("fatal_peremptorio"),
    descricao: text("descricao"),
    dataDisponibilizacao: date("data_disponibilizacao", { mode: "string" }),
    dataPublicacao: date("data_publicacao", { mode: "string" }),
    dataInicioContagem: date("data_inicio_contagem", { mode: "string" }),
    dataVencimento: date("data_vencimento", { mode: "string" }), // null enquanto "a_calcular"
    dias: integer("dias"),
    contagem: contagemPrazoEnum("contagem").notNull().default("uteis"),
    meioComunicacao: meioComunicacaoEnum("meio_comunicacao"),
    responsavelId: uuid("responsavel_id"),
    status: statusPrazoEnum("status").notNull().default("a_calcular"),
    // Contrato de saída do motor de prazo (revisão E3):
    nivelConfianca: integer("nivel_confianca"), // 0-100
    motivosIncerteza: jsonb("motivos_incerteza").$type<string[]>(),
    dataSugerida: date("data_sugerida", { mode: "string" }), // valor da máquina
    // Validação humana AUDITADA (revisão E6) — bloqueia avanço de fatal sem isto.
    validadoPorId: uuid("validado_por_id"),
    validadoEm: timestamp("validado_em", { withTimezone: true }),
    valorConfirmado: date("valor_confirmado", { mode: "string" }),
    fonte: text("fonte"),
    lembreteEnviadoEm: timestamp("lembrete_enviado_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_prazos_processo").on(t.processoId),
    index("idx_prazos_venc").on(t.clienteId, t.dataVencimento),
    index("idx_prazos_status").on(t.status),
  ],
);

export const tipoAudienciaEnum = pgEnum("tipo_audiencia", [
  "conciliacao",
  "una",
  "instrucao",
  "outra",
]);
export const modalidadeAudienciaEnum = pgEnum("modalidade_audiencia", ["presencial", "virtual"]);
export const audiencias = pgTable(
  "audiencias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id")
      .notNull()
      .references(() => processos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
    tipo: tipoAudienciaEnum("tipo").notNull().default("conciliacao"),
    dataHora: timestamp("data_hora", { withTimezone: true }).notNull(),
    modalidade: modalidadeAudienciaEnum("modalidade").notNull().default("presencial"),
    vara: text("vara"),
    prepostoNome: text("preposto_nome"),
    prepostoWhatsapp: text("preposto_whatsapp"),
    checklistDocumentos: jsonb("checklist_documentos").$type<{ item: string; ok: boolean }[]>(),
    resultado: text("resultado"),
    lembreteEnviado: boolean("lembrete_enviado").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_audiencias_processo").on(t.processoId, t.dataHora)],
);

export const classificacaoProvisaoEnum = pgEnum("classificacao_provisao", [
  "provavel",
  "possivel",
  "remoto",
]);
export const provisoes = pgTable(
  "provisoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id")
      .notNull()
      .references(() => processos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
    classificacao: classificacaoProvisaoEnum("classificacao").notNull().default("possivel"),
    valorProvisionadoCents: integer("valor_provisionado_cents"),
    valorDesembolsadoCents: integer("valor_desembolsado_cents"),
    motivoMudanca: text("motivo_mudanca"),
    historico: jsonb("historico").$type<Record<string, unknown>[]>(),
    classificadoPorId: uuid("classificado_por_id"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_provisoes_processo").on(t.processoId)],
);

export const tarefaStatusEnum = pgEnum("tarefa_status", ["aberta", "concluida", "cancelada"]);
export const tarefas = pgTable(
  "tarefas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id").notNull(),
    processoId: uuid("processo_id").references(() => processos.id, { onDelete: "cascade" }),
    etapaChave: text("etapa_chave"),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    responsavelId: uuid("responsavel_id"),
    prazoData: date("prazo_data", { mode: "string" }),
    prioridade: integer("prioridade").notNull().default(0),
    status: tarefaStatusEnum("status").notNull().default("aberta"),
    geradaPorAutomacao: boolean("gerada_por_automacao").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
  },
  (t) => [index("idx_tarefas_processo").on(t.processoId), index("idx_tarefas_resp").on(t.responsavelId, t.status)],
);

export const tipoRecursoEnum = pgEnum("tipo_recurso", [
  "ro",
  "rr",
  "apelacao",
  "agravo_instrumento",
  "agravo_peticao",
  "embargos",
  "impugnacao",
  "recurso_inominado",
  "resp",
  "re",
  "outro",
]);
export const recursos = pgTable(
  "recursos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id")
      .notNull()
      .references(() => processos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
    tipo: tipoRecursoEnum("tipo").notNull(),
    instancia: text("instancia"),
    status: text("status"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_recursos_processo").on(t.processoId)],
);

export const pericias = pgTable(
  "pericias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id")
      .notNull()
      .references(() => processos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
    objeto: text("objeto"),
    perito: text("perito"),
    laudoDocumentoId: uuid("laudo_documento_id"),
    status: text("status"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_pericias_processo").on(t.processoId)],
);

// Proposta/aceite de contencioso — cobrança é caso a caso (nada incluso).
export const statusEngajamentoEnum = pgEnum("status_engajamento", [
  "proposto",
  "aceito",
  "recusado",
  "cancelado",
]);
export const engajamentosContencioso = pgTable(
  "engajamentos_contencioso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id").references(() => processos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").notNull(),
    descricao: text("descricao").notNull(),
    valorCents: integer("valor_cents"),
    honorariosDescricao: text("honorarios_descricao"),
    exitoDescricao: text("exito_descricao"),
    status: statusEngajamentoEnum("status").notNull().default("proposto"),
    propostoPorId: uuid("proposto_por_id"),
    propostoEm: timestamp("proposto_em", { withTimezone: true }).notNull().defaultNow(),
    aceitoEm: timestamp("aceito_em", { withTimezone: true }),
    aceitoPorId: uuid("aceito_por_id"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_engajamentos_cliente").on(t.clienteId, t.status)],
);

// ===========================================================================
// Calendário forense (motor de prazo) — nacionais no seed; comarca/UF entram aqui.
// ===========================================================================
export const tipoDataForenseEnum = pgEnum("tipo_data_forense", ["feriado", "suspensao", "recesso"]);
export const calendarioForense = pgTable(
  "calendario_forense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdicao: text("jurisdicao").notNull().default("nacional"), // nacional|uf|comarca
    uf: text("uf"),
    comarca: text("comarca"),
    data: date("data", { mode: "string" }).notNull(),
    tipo: tipoDataForenseEnum("tipo").notNull().default("feriado"),
    descricao: text("descricao"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_calendario_data").on(t.data)],
);

// ===========================================================================
// Tipos exportados
// ===========================================================================
export type AuditLog = typeof auditLog.$inferSelect;
export type Cliente = typeof clientes.$inferSelect;
export type Documento = typeof documentos.$inferSelect;
export type Modelo = typeof modelos.$inferSelect;
export type Reuniao = typeof reunioes.$inferSelect;
export type Consulta = typeof consultas.$inferSelect;
export type Funil = typeof funis.$inferSelect;
export type FunilEtapa = typeof funilEtapas.$inferSelect;
export type FunilInscricao = typeof funilInscricoes.$inferSelect;
export type Processo = typeof processos.$inferSelect;
export type Parte = typeof partes.$inferSelect;
export type Andamento = typeof andamentos.$inferSelect;
export type Prazo = typeof prazos.$inferSelect;
export type Audiencia = typeof audiencias.$inferSelect;
export type Provisao = typeof provisoes.$inferSelect;
export type Tarefa = typeof tarefas.$inferSelect;
export type Recurso = typeof recursos.$inferSelect;
export type Pericia = typeof pericias.$inferSelect;
export type EngajamentoContencioso = typeof engajamentosContencioso.$inferSelect;
