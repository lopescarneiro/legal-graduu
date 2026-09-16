CREATE TYPE "public"."acao_auditoria" AS ENUM('view', 'download', 'write', 'delete', 'login', 'export');--> statement-breakpoint
CREATE TYPE "public"."avaliacao_ia_status" AS ENUM('ok', 'revisar', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."base_legal" AS ENUM('execucao_contrato', 'exercicio_direitos', 'obrigacao_legal', 'legitimo_interesse');--> statement-breakpoint
CREATE TYPE "public"."categoria_documento" AS ENUM('funcionarios', 'fornecedores', 'locacao', 'lgpd', 'societario', 'processo', 'outros');--> statement-breakpoint
CREATE TYPE "public"."classificacao_provisao" AS ENUM('provavel', 'possivel', 'remoto');--> statement-breakpoint
CREATE TYPE "public"."contagem_prazo" AS ENUM('uteis', 'corridos');--> statement-breakpoint
CREATE TYPE "public"."fase_macro" AS ENUM('conhecimento', 'recursal', 'execucao');--> statement-breakpoint
CREATE TYPE "public"."funil_tipo" AS ENUM('processo_trabalhista', 'processo_civel', 'processo_consumidor');--> statement-breakpoint
CREATE TYPE "public"."meio_comunicacao" AS ENUM('djen', 'domicilio', 'oficial');--> statement-breakpoint
CREATE TYPE "public"."modalidade_audiencia" AS ENUM('presencial', 'virtual');--> statement-breakpoint
CREATE TYPE "public"."origem_andamento" AS ENUM('manual', 'captura_djen', 'datajud', 'intimacao');--> statement-breakpoint
CREATE TYPE "public"."origem_upload" AS ENUM('polo', 'escritorio');--> statement-breakpoint
CREATE TYPE "public"."papel_polo" AS ENUM('reu', 'autor', 'terceiro');--> statement-breakpoint
CREATE TYPE "public"."ramo_processo" AS ENUM('trabalhista', 'civel', 'consumidor');--> statement-breakpoint
CREATE TYPE "public"."sigilo" AS ENUM('normal', 'sensivel', 'segredo_justica');--> statement-breakpoint
CREATE TYPE "public"."situacao_processo" AS ENUM('ativo', 'suspenso', 'encerrado', 'arquivado');--> statement-breakpoint
CREATE TYPE "public"."status_cliente" AS ENUM('ativo', 'inadimplente', 'inativo');--> statement-breakpoint
CREATE TYPE "public"."status_consulta" AS ENUM('aberta', 'respondida', 'encerrada');--> statement-breakpoint
CREATE TYPE "public"."status_documento" AS ENUM('em_dia', 'a_vencer', 'pendente', 'nao_avaliado');--> statement-breakpoint
CREATE TYPE "public"."status_engajamento" AS ENUM('proposto', 'aceito', 'recusado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."status_prazo" AS ENUM('a_calcular', 'aberto', 'cumprido', 'perdido');--> statement-breakpoint
CREATE TYPE "public"."status_reuniao" AS ENUM('agendada', 'realizada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."tarefa_status" AS ENUM('aberta', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."tipo_audiencia" AS ENUM('conciliacao', 'una', 'instrucao', 'outra');--> statement-breakpoint
CREATE TYPE "public"."tipo_data_forense" AS ENUM('feriado', 'suspensao', 'recesso');--> statement-breakpoint
CREATE TYPE "public"."tipo_prazo" AS ENUM('fatal_peremptorio', 'dilatorio');--> statement-breakpoint
CREATE TYPE "public"."tipo_recurso" AS ENUM('ro', 'rr', 'apelacao', 'agravo_instrumento', 'agravo_peticao', 'embargos', 'impugnacao', 'recurso_inominado', 'resp', 're', 'outro');--> statement-breakpoint
CREATE TABLE "andamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"data" date NOT NULL,
	"descricao" text NOT NULL,
	"origem" "origem_andamento" DEFAULT 'manual' NOT NULL,
	"codigo_tpu" text,
	"documento_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audiencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" "tipo_audiencia" DEFAULT 'conciliacao' NOT NULL,
	"data_hora" timestamp with time zone NOT NULL,
	"modalidade" "modalidade_audiencia" DEFAULT 'presencial' NOT NULL,
	"vara" text,
	"preposto_nome" text,
	"preposto_whatsapp" text,
	"checklist_documentos" jsonb,
	"resultado" text,
	"lembrete_enviado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"cliente_id" uuid,
	"ator_id" uuid,
	"ator_papel" text,
	"ip" text,
	"acao" "acao_auditoria" NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text,
	"detalhe" jsonb,
	"prev_hash" text,
	"hash" text
);
--> statement-breakpoint
CREATE TABLE "calendario_forense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdicao" text DEFAULT 'nacional' NOT NULL,
	"uf" text,
	"comarca" text,
	"data" date NOT NULL,
	"tipo" "tipo_data_forense" DEFAULT 'feriado' NOT NULL,
	"descricao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"cnpj" text,
	"telefone" text,
	"status" "status_cliente" DEFAULT 'ativo' NOT NULL,
	"cobranca_configurada" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"criada_por_id" uuid,
	"assunto" text NOT NULL,
	"pergunta" text NOT NULL,
	"status" "status_consulta" DEFAULT 'aberta' NOT NULL,
	"sla_vence_em" timestamp with time zone,
	"resposta" text,
	"respondida_por_id" uuid,
	"respondida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documento_avaliacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"resumo" text,
	"pendencias" jsonb,
	"riscos" jsonb,
	"score" integer,
	"status" "avaliacao_ia_status" DEFAULT 'revisar' NOT NULL,
	"validado_por_id" uuid,
	"validado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"processo_id" uuid,
	"categoria" "categoria_documento" DEFAULT 'outros' NOT NULL,
	"tipo_peca" text,
	"nome" text NOT NULL,
	"arquivo_path" text,
	"mime" text,
	"tamanho_bytes" integer,
	"versao" integer DEFAULT 1 NOT NULL,
	"status" "status_documento" DEFAULT 'nao_avaliado' NOT NULL,
	"sigilo" "sigilo" DEFAULT 'normal' NOT NULL,
	"contem_dados_sensiveis" boolean DEFAULT false NOT NULL,
	"vencimento_em" date,
	"uploaded_by_tipo" "origem_upload",
	"uploaded_by_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engajamentos_contencioso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid,
	"cliente_id" uuid NOT NULL,
	"descricao" text NOT NULL,
	"valor_cents" integer,
	"honorarios_descricao" text,
	"exito_descricao" text,
	"status" "status_engajamento" DEFAULT 'proposto' NOT NULL,
	"proposto_por_id" uuid,
	"proposto_em" timestamp with time zone DEFAULT now() NOT NULL,
	"aceito_em" timestamp with time zone,
	"aceito_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funil_etapas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funil_id" uuid NOT NULL,
	"chave" text NOT NULL,
	"nome" text NOT NULL,
	"cor" text DEFAULT '#64748b' NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"eh_terminal" boolean DEFAULT false NOT NULL,
	"sla_dias" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funil_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"entidade" text DEFAULT 'processo' NOT NULL,
	"entidade_id" uuid NOT NULL,
	"funil_id" uuid,
	"de_etapa_id" uuid,
	"para_etapa_id" uuid,
	"origem" text DEFAULT 'manual' NOT NULL,
	"usuario_id" uuid,
	"obs" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funil_inscricoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funil_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"entidade" text DEFAULT 'processo' NOT NULL,
	"entidade_id" uuid NOT NULL,
	"etapa_id" uuid,
	"etapa_desde" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "funil_tipo" NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"eh_padrao" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modelo_geracoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modelo_id" uuid NOT NULL,
	"cliente_id" uuid,
	"valores" jsonb,
	"conteudo_gerado" text,
	"documento_id" uuid,
	"criado_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modelos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"categoria" "categoria_documento" DEFAULT 'outros' NOT NULL,
	"descricao" text,
	"corpo" text NOT NULL,
	"variaveis" jsonb,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"papel" text NOT NULL,
	"nome" text NOT NULL,
	"cpf_cnpj" text,
	"polo_ativo_passivo" text,
	"advogado_adverso" text,
	"oab" text,
	"eh_polo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pericias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"objeto" text,
	"perito" text,
	"laudo_documento_id" uuid,
	"status" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prazos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" "tipo_prazo" DEFAULT 'fatal_peremptorio' NOT NULL,
	"descricao" text,
	"data_disponibilizacao" date,
	"data_publicacao" date,
	"data_inicio_contagem" date,
	"data_vencimento" date,
	"dias" integer,
	"contagem" "contagem_prazo" DEFAULT 'uteis' NOT NULL,
	"meio_comunicacao" "meio_comunicacao",
	"responsavel_id" uuid,
	"status" "status_prazo" DEFAULT 'a_calcular' NOT NULL,
	"nivel_confianca" integer,
	"motivos_incerteza" jsonb,
	"data_sugerida" date,
	"validado_por_id" uuid,
	"validado_em" timestamp with time zone,
	"valor_confirmado" date,
	"fonte" text,
	"lembrete_enviado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"numero_cnj" text,
	"ramo" "ramo_processo" NOT NULL,
	"tipo_acao" text,
	"tipo_causa" text,
	"rito" text,
	"tribunal" text,
	"vara" text,
	"comarca" text,
	"papel_do_polo" "papel_polo" DEFAULT 'reu' NOT NULL,
	"valor_causa_cents" integer,
	"estagio_atual_id" uuid,
	"fase_macro" "fase_macro" DEFAULT 'conhecimento' NOT NULL,
	"situacao" "situacao_processo" DEFAULT 'ativo' NOT NULL,
	"data_citacao" date,
	"data_distribuicao" date,
	"advogado_responsavel_id" uuid,
	"segredo_justica" boolean DEFAULT false NOT NULL,
	"hipotese_segredo" text,
	"dados_sensiveis" boolean DEFAULT false NOT NULL,
	"base_legal" "base_legal",
	"finalidade" text,
	"resumo_humanizado" text,
	"pendente_confirmacao" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provisoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"classificacao" "classificacao_provisao" DEFAULT 'possivel' NOT NULL,
	"valor_provisionado_cents" integer,
	"valor_desembolsado_cents" integer,
	"motivo_mudanca" text,
	"historico" jsonb,
	"classificado_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recursos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" "tipo_recurso" NOT NULL,
	"instancia" text,
	"status" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reunioes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"data_hora" timestamp with time zone NOT NULL,
	"competencia" text,
	"tipo" text,
	"status" "status_reuniao" DEFAULT 'agendada' NOT NULL,
	"link" text,
	"observacoes" text,
	"lembrete_enviado" boolean DEFAULT false NOT NULL,
	"agendada_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"processo_id" uuid,
	"etapa_chave" text,
	"titulo" text NOT NULL,
	"descricao" text,
	"responsavel_id" uuid,
	"prazo_data" date,
	"prioridade" integer DEFAULT 0 NOT NULL,
	"status" "tarefa_status" DEFAULT 'aberta' NOT NULL,
	"gerada_por_automacao" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "andamentos" ADD CONSTRAINT "andamentos_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audiencias" ADD CONSTRAINT "audiencias_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_avaliacoes" ADD CONSTRAINT "documento_avaliacoes_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engajamentos_contencioso" ADD CONSTRAINT "engajamentos_contencioso_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funil_etapas" ADD CONSTRAINT "funil_etapas_funil_id_funis_id_fk" FOREIGN KEY ("funil_id") REFERENCES "public"."funis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funil_historico" ADD CONSTRAINT "funil_historico_funil_id_funis_id_fk" FOREIGN KEY ("funil_id") REFERENCES "public"."funis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funil_inscricoes" ADD CONSTRAINT "funil_inscricoes_funil_id_funis_id_fk" FOREIGN KEY ("funil_id") REFERENCES "public"."funis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funil_inscricoes" ADD CONSTRAINT "funil_inscricoes_etapa_id_funil_etapas_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."funil_etapas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modelo_geracoes" ADD CONSTRAINT "modelo_geracoes_modelo_id_modelos_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."modelos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modelo_geracoes" ADD CONSTRAINT "modelo_geracoes_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes" ADD CONSTRAINT "partes_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pericias" ADD CONSTRAINT "pericias_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prazos" ADD CONSTRAINT "prazos_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos" ADD CONSTRAINT "processos_estagio_atual_id_funil_etapas_id_fk" FOREIGN KEY ("estagio_atual_id") REFERENCES "public"."funil_etapas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisoes" ADD CONSTRAINT "provisoes_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recursos" ADD CONSTRAINT "recursos_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_andamentos_processo" ON "andamentos" USING btree ("processo_id","data");--> statement-breakpoint
CREATE INDEX "idx_audiencias_processo" ON "audiencias" USING btree ("processo_id","data_hora");--> statement-breakpoint
CREATE INDEX "idx_audit_cliente_data" ON "audit_log" USING btree ("cliente_id","criado_em");--> statement-breakpoint
CREATE INDEX "idx_audit_entidade" ON "audit_log" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "idx_calendario_data" ON "calendario_forense" USING btree ("data");--> statement-breakpoint
CREATE INDEX "idx_consultas_cliente" ON "consultas" USING btree ("cliente_id","status");--> statement-breakpoint
CREATE INDEX "idx_avaliacoes_documento" ON "documento_avaliacoes" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "idx_documentos_cliente_cat" ON "documentos" USING btree ("cliente_id","categoria");--> statement-breakpoint
CREATE INDEX "idx_documentos_processo" ON "documentos" USING btree ("processo_id");--> statement-breakpoint
CREATE INDEX "idx_engajamentos_cliente" ON "engajamentos_contencioso" USING btree ("cliente_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_funil_etapa_chave" ON "funil_etapas" USING btree ("funil_id","chave");--> statement-breakpoint
CREATE INDEX "idx_funil_historico_entidade" ON "funil_historico" USING btree ("entidade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_funil_inscricao" ON "funil_inscricoes" USING btree ("funil_id","entidade_id");--> statement-breakpoint
CREATE INDEX "idx_geracoes_cliente" ON "modelo_geracoes" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_partes_processo" ON "partes" USING btree ("processo_id");--> statement-breakpoint
CREATE INDEX "idx_pericias_processo" ON "pericias" USING btree ("processo_id");--> statement-breakpoint
CREATE INDEX "idx_prazos_processo" ON "prazos" USING btree ("processo_id");--> statement-breakpoint
CREATE INDEX "idx_prazos_venc" ON "prazos" USING btree ("cliente_id","data_vencimento");--> statement-breakpoint
CREATE INDEX "idx_prazos_status" ON "prazos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_processos_cliente" ON "processos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_processos_cnj" ON "processos" USING btree ("numero_cnj");--> statement-breakpoint
CREATE INDEX "idx_processos_ramo" ON "processos" USING btree ("ramo");--> statement-breakpoint
CREATE INDEX "idx_provisoes_processo" ON "provisoes" USING btree ("processo_id");--> statement-breakpoint
CREATE INDEX "idx_recursos_processo" ON "recursos" USING btree ("processo_id");--> statement-breakpoint
CREATE INDEX "idx_reunioes_cliente" ON "reunioes" USING btree ("cliente_id","data_hora");--> statement-breakpoint
CREATE INDEX "idx_tarefas_processo" ON "tarefas" USING btree ("processo_id");--> statement-breakpoint
CREATE INDEX "idx_tarefas_resp" ON "tarefas" USING btree ("responsavel_id","status");