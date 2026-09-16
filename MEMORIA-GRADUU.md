# Legal Graduu — memória portável (lida pelo Claude Code)

> Contexto do app importado pelo `CLAUDE.md`. **Não colocar segredos aqui.**
> Docs de planejamento (na raiz `E:\dev`): `legal-graduu-mvp-spec.md` (v2, a spec da Fase 1),
> `legal-graduu-revisao-mvp.md` (revisão adversarial + disposição), `legal-graduu-pauta-escritorio.md`
> (decisões do escritório), `pesquisa-modulo-processos.md` (benchmark), `demonstrativo-assessoria-juridica-polos.md`.

## O que é
Assessoria jurídica por assinatura para **polos EAD**, *powered by* **Verônica Gilioli Advogados**.
Contencioso **trabalhista, cível empresarial e consumidor** (do polo como empresa; o aluno-consumidor é da IES).

- **Graduu = SÓ O SISTEMA (SaaS).** O escritório é o contratante do serviço jurídico e detém OAB/honorários.
- **Cobrança ao polo em nome do ESCRITÓRIO** (Modelo B do Hub: o escritório pluga a própria conta Asaas via `integracoes`). A Graduu cobra do escritório uma taxa de software (Modelo A). **Sem partilha de honorários.**
- **Sem contencioso incluso** na mensalidade (paga a camada preventiva: Compliance + reuniões + consultas). Contencioso = **proposta caso a caso** do escritório.

## É um app da suíte Graduu (mesmo padrão)
- Repo/banco próprios, mas **dentro do Hub**: SSO via handoff (`{HUB_URL}/api/handoff/exchange` com `x-app-secret`), tile gated por plano, papéis do Hub. Banco próprio isola o dado jurídico (sigilo/LGPD).
- **Stack:** Next 16 (App Router; middleware = `src/proxy.ts`), React 19, Drizzle (`drizzle-kit push`, schema-first), Auth.js v5, Zod 4, **Base UI** via `@graduu/ui` (prop `render`, não `asChild`), PGlite (dev)/Postgres-Supabase (prod). npm.
- **Regras de ouro:** dinheiro em centavos; datas 'YYYY-MM-DD'; cercar TODA query por `orgId`/`poloId` (fail-closed; escopo vazio = nada, NUNCA "vê tudo"); S2S com `timingSafeEqual`; `referenciaExterna` é contrato — não mudar.

## Decisões de arquitetura (desta build)
- **Ator "escritório"** = advogado cross-polo. Modelar como no **atende** (sessão carrega caminhos de ACL combinados por OR, sempre `AND orgId`), espelhando o padrão do `adminOrg` do Hub (flag org-wide + claim no handoff). **"Só advogados", escritório vê tudo** (sem need-to-know intra-escritório). A inadimplência do polo NÃO corta o acesso operacional do escritório (dever profissional).
- **RLS de runtime REAL** (upgrade sobre a suíte, que só cerca na aplicação): role não-privilegiada + `set_config('app.current_org', ...)` por transação + policies. Justificado pelo sigilo.
- **Auditoria desde o scaffold** (`audit_log`, VIEW/DOWNLOAD, append-only + hash-chain). A validação humana de prazo é evento auditável (defesa contra perda de prazo).
- **Motor de funil** = portar o do matriculador (5 tabelas + `regua_envios`; `funis.tipo` += `processo_trabalhista|processo_civel|processo_consumidor`). Retrocesso: `moverEtapaCore` já move p/ trás; o que muda é o modelo de disparo (etapa → tarefa/prazo/notificação, não template once-per-key).
- **Motor de prazo (Fase 1b):** determinístico com contrato `{data_sugerida, nivel_confianca, motivos_incerteza[]}` + **validação humana obrigatória e auditada**; comarca/calendário desconhecido ⇒ "a calcular" (nunca inferir com calendário parcial). `feriados.ts` cobre só nacionais — recesso/estadual/municipal/forense entram no motor.

## ⚠️ Bloqueadores OAB — parecer ANTES de expor a cliente real (flip OFF→ON)
- **L1** captação/intermediação: a oferta/venda é do escritório; a Graduu é SaaS; **score de êxito NUNCA aparece ao polo/prospect** (fica interno à triagem).
- **L3** publicidade de preço jurídico (Prov. 205/2021): preço do serviço jurídico só pós-login.
- **L4** IA lendo PDF sigiloso: transferência internacional (art. 33) + sigilo → **excluir docs sigilosos do pipeline de IA** ou OCR/inferência no BR; autorização expressa do cliente.
- **L5** quota litis p/ PJ: preferir honorários fixos/por-ato.
- **L2 RESOLVIDO:** cobrança em nome do escritório (acima).

## ⚠️ Gotchas da suíte
- **Push no `main` = deploy de PRODUÇÃO.** Acompanhar até READY. Este app **nasce OFF/atrás de flag**.
- **Migração:** `drizzle-kit push` schema-first; o build NÃO aplica migração. Schema novo = aplicar no Supabase + refletir no `schema.ts`. **Ligar RLS em tabela public nova.**
- Adicionar `legal-graduu` ao Hub exige estender: `appSlugEnum` (schema) + `apps` (seed) + `AppId` (iam.ts) + `ehAppId` (handoff.ts) + `APP_META` (page.tsx) + recurso `legal` (planos-catalogo/plano) + plano "Jurídico" R$399. (Mudança em app de PRODUÇÃO — revisar ao vivo com o Paulo.)

## Como trabalhar (preferência do Paulo)
- Confirmar SEMPRE o READY do deploy e levar a tarefa ao estado final verificado.
- Mudança sensível (dinheiro/schema/Hub): branch → preview → merge travado.
