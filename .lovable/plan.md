# Multi-empresa (Holding) + App do Colaborador

Reestruturar RH para operar como holding com N empresas. Renomear o app do promotor para "App do Colaborador" removendo rotas/merchandising. Ponto por facial controlado por empresa e por colaborador. Dashboard central consolidado.

Obs: banco é Postgres do backend (Easypanel via `apianatriello.r2d2.agency`), não Supabase. Tudo passa por schemas SQL do backend + rotas REST.

---

## 1. Backend — Schema (novo `schema-holding.sql`)

Tabela nova `companies` (empresas da holding):
- `id`, `organization_id` (holding), `name`, `cnpj`, `trade_name`, `logo_url`, `color`, `address`, `phone`, `email`, `is_active`, `punch_facial_required` (bool default true), `punch_facial_tolerance_days` (fallback), `created_at`, `updated_at`
- Índice único: `(organization_id, cnpj)`
- Seed automático: uma company "Anatriello" por organization ao iniciar

Alterações em tabelas existentes de RH:
- `employees`: adicionar `company_id` (FK companies, NOT NULL após migração), `facial_required` já existe (usar como override do que a company exige)
- `time_punches` / `ponto`: adicionar `company_id` (denormalizado a partir do employee no insert)
- `employee_documents`: adicionar `company_id`
- `punch_adjustments` (nova ou existente): `id`, `employee_id`, `company_id`, `punch_id?`, `type` (falta/atraso/esquecimento), `requested_at`, `requested_by`, `justification`, `attachment_url?`, `status` (pending/approved/rejected), `reviewed_by?`, `reviewed_at?`, `review_note?`
- `document_deliveries` (nova): `id`, `document_id`, `employee_id`, `company_id`, `sent_at`, `read_at?`, `signed_at?`, `signature_hash?`, `status`

GRANTs e índices em tudo. Início zerado — colaboradores/pontos existentes não migram (usuário confirmou "começar do zero").

## 2. Backend — Rotas REST

Arquivos novos em `backend/src/routes/`:
- `companies.js` — CRUD `/api/companies` (listar/criar/editar/desativar; escopo = organization_id do usuário)
- `punch-adjustments.js` — `/api/punch-adjustments` (colaborador cria; RH lista/aprova/rejeita; filtro por company)
- `document-deliveries.js` — `/api/document-deliveries` (RH envia; colaborador confirma leitura/assina)
- `holding-dashboard.js` — `/api/holding/dashboard` agregando:
  - colaboradores ativos por empresa
  - batidas do dia por empresa (in/out/breaks)
  - contadores de alertas (atrasos hoje, faltas, docs vencendo em 30d, ajustes pendentes)

Ajustar rotas existentes para receber/filtrar `company_id`:
- `/api/employees` (create/list aceitam `company_id`)
- `/api/rh/ponto` (batida grava `company_id`)
- `/api/rh/documentos` (upload vinculado a `company_id`; envio dispara `document_deliveries`)

Regra facial de ponto (no endpoint de batida):
1. Se `employees.facial_required` for `true`/`false` → prevalece.
2. Senão → usa `companies.punch_facial_required`.
3. Se exigido e falhar → 403 com motivo; grava tentativa em `app_logs`.

## 3. Frontend Admin

- Nova página `/rh/empresas` (CRUD empresas + toggle "Exigir facial no ponto" por empresa).
- Novo dashboard `/rh/holding` (padrão do RH):
  - Cards por empresa: ativos, presentes hoje, atrasos, ajustes pendentes
  - Gráfico consolidado de batidas do dia
  - Feed de alertas com filtro por empresa
  - Aba "Ajustes de ponto" com aprovação (aprovar/rejeitar + nota)
  - Aba "Envios de documentos" (status leitura/assinatura)
- Ajustes em telas existentes (`RHColaboradores`, `RHPonto`, `RHDocumentos`, `RHBiometria`):
  - Seletor "Empresa" no topo (persistido em localStorage)
  - Campo `company_id` obrigatório no cadastro do colaborador
  - Coluna "Empresa" nas listagens
  - Em `RHColaboradores`, substituir o seletor 3-state genérico por: "Facial: Herdar da empresa | Sempre exigir | Nunca exigir"

## 4. App do Colaborador (renomear `/promotor` → `/colaborador`)

Manter a rota `/promotor` como alias temporário (redirect) para não quebrar quem já tem PWA instalado, mas nova identidade em `/colaborador`.

Remover do menu/rotas do app:
- Rota (`PromotorRota`), Marcas, Categorias, Perdas, Fotos, Book, Merchandising, Pesquisa de preço, Auditoria, Solicitações de visita.

Manter/adaptar:
- Login (mesmo AuthContext)
- Home: cards "Bater ponto" + "Meus documentos" + "Meus ajustes"
- `/colaborador/ponto`: câmera facial → chama `/api/rh/ponto` (backend valida facial conforme regra). Mostra empresa atual (se colaborador tem `company_id` só uma).
- `/colaborador/documentos`: lista `document_deliveries` do colaborador, permite confirmar leitura/assinar; permite enviar documentos pessoais para o RH.
- `/colaborador/ajustes`: histórico de ajustes solicitados + botão "Solicitar ajuste".
- `/colaborador/config`: só facial enrollment + tema + sair.

Renomear referências textuais "Promotor" → "Colaborador" nos labels e no manifest `promoter-app-manifest.webmanifest`.

## 5. Início zerado

Script no `init-db.js`:
- Cria tabela `companies` e adiciona colunas em employees/ponto/documentos (idempotente, `IF NOT EXISTS`).
- Insere company padrão "Anatriello" por organização.
- **Não faz TRUNCATE**. "Começar do zero" = as tabelas novas nascem vazias; se o usuário quiser limpar employees/pontos existentes, faço em passo separado após confirmação explícita (destrutivo).

---

## Ordem de entrega

1. Backend: `schema-holding.sql` + init-db + rotas novas + patches nas rotas de RH.
2. Frontend admin: página empresas, dashboard holding, ajustes nas telas RH.
3. App do Colaborador: remover módulos merchandising, adaptar telas, renomear.
4. QA rápido: seed empresa Anatriello, criar colaborador, bater ponto, enviar documento, aprovar ajuste.

Confirma para eu executar? Se quiser priorizar (ex: só backend + dashboard antes do app), me diz.
