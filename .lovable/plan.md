# App do Colaborador — Anatriello

App mobile web (PWA já existente) para o colaborador registrar ponto, acompanhar jornada, fazer solicitações e acessar seus dados. Visual fiel ao mockup enviado (dark navy + laranja, cards arredondados, bottom tabs).

## Escopo desta entrega

1. **Ponto e Jornada**
   - Home com card "PONTO": horário atual, situação (fora/em jornada/almoço), horário previsto de entrada e almoço.
   - Botão "REGISTRAR PONTO" em fluxo único: detecta o próximo tipo (entrada → saída almoço → retorno → saída → extra).
   - Captura GPS (obrigatório). Bloqueia se fora do raio da empresa vinculada.
   - Se `facial_required = true` no cadastro do colaborador → exige validação facial (usa `facial-recognition.ts` já existente). Caso contrário, dispensa.
   - Empresa vinculada é lida automaticamente de `employees.company_id` (sem seletor).
   - Modo offline: persiste em IndexedDB e sincroniza quando online (reaproveita `use-offline-sync`).
   - Tela "Minha Jornada": abas Dia / Semana / Mês, timeline dos batidos (Entrada, Início Almoço, Fim Almoço, Saída Prevista/Saída) com status "No horário / Atraso / Pendente", resumo do dia (Trabalhado, Almoço, Total, Saldo) e Banco de Horas.

2. **Solicitações**
   - Lista abas Minhas / Histórico, cards por tipo: Férias, Afastamento, Vale-transporte, 2ª via de holerite, **Horas extras**, **Ajuste de ponto**, **Atestado médico**.
   - FAB "+" abre modal para nova solicitação com formulário por tipo (datas, motivo, anexo).
   - Status: Pendente / Aprovado / Recusado / Concluído.
   - Backend reaproveita tabelas existentes: `vacations`, `absences`, `medical_certificates`, `punch_adjustments`. Cria tabela nova `employee_requests` para tipos genéricos (vale-transporte, 2ª via, horas extras).

3. **Férias (tela dedicada)**
   - Período aquisitivo, cards "Dias totais / gozados / restantes", botão "SOLICITAR FÉRIAS", próximas férias, histórico. Usa `vacations`.

4. **Holerite**
   - Lista mensal com valor bruto e data de pagamento; download PDF. Usa `payslips`.

5. **Documentos**
   - Pastas: Admissão, Contratuais, Pessoais, Holerites, Férias, Avaliações, Treinamentos.
   - Visualiza documentos enviados pelo RH (`rh_documents`) e permite upload/entrega pelo colaborador (`document_deliveries`).

6. **Benefícios e Comunicados**
   - Card na home com últimos comunicados (paginado).
   - Tela Benefícios: lista de benefícios ativos do colaborador (VA/VR, plano saúde, odonto, seguro).

7. **Perfil**
   - Dados pessoais, contato, dependentes, dados bancários (com PIX), endereço, configurações, privacidade — todos em modo leitura + solicitar alteração (gera `employee_requests`).
   - Foto do colaborador (usa foto facial cadastrada).

## Arquitetura técnica

- **Rotas** (novas em `src/pages/promotor/` — reaproveita `PromotorLayout` renomeado visualmente para "Colaborador"):
  - `/app/home` (novo `ColaboradorHome.tsx`)
  - `/app/jornada`
  - `/app/solicitacoes`
  - `/app/ferias`
  - `/app/holerite`
  - `/app/documentos`
  - `/app/beneficios`
  - `/app/perfil`
  - Reaproveita `PromoterAppAuthContext` para autenticação do colaborador.

- **Design tokens** (`src/index.css` — novo tema "colaborador-app" escopado por rota):
  - `--bg`: `220 40% 8%` (navy escuro)
  - `--card`: `0 0% 100%`
  - `--brand`: `18 95% 55%` (laranja Anatriello)
  - Tipografia: manter Inter (já em uso), pesos 600/700 para títulos.

- **Bottom tabs** (novo `ColaboradorTabs.tsx`): Início / Jornada / Solicitações / Perfil.

- **Backend** (novos endpoints em `backend/src/routes/colaborador-app.js`):
  - `GET /api/colab/me` — dados do colaborador + empresa + config facial/gps.
  - `POST /api/colab/punch` — registra ponto com validação de raio da empresa (`companies.lat/lng/radius`) e match facial opcional.
  - `GET /api/colab/journey?date=` — jornada do dia consolidada.
  - `GET /api/colab/journey/summary?period=week|month` — resumo com banco de horas.
  - `GET/POST /api/colab/requests` — CRUD de `employee_requests` + adapters para férias/afastamento/atestado.
  - `GET /api/colab/payslips`, `GET /api/colab/documents`, `POST /api/colab/documents` (upload), `GET /api/colab/benefits`, `GET /api/colab/announcements`.

- **Migrations** (`backend/src/init-db.js` — ensureTables):
  - `employee_requests(id, employee_id, company_id, kind, payload jsonb, status, requested_at, resolved_at, resolved_by, notes)`.
  - `company_announcements(id, company_id, title, body, published_at, created_by)`.
  - `employee_benefits(id, employee_id, kind, label, value_cents, provider, status)`.
  - Garante colunas em `companies`: `lat`, `lng`, `punch_radius_m default 150`.

- **Validação de ponto**:
  - Facial: `facial-recognition.ts` com WebGL + fallback CPU, threshold 0.6 (já implementado).
  - GPS: Haversine contra `companies.lat/lng`; se fora do raio, requer justificativa (grava `geo_status='fora_area'`).

- **Offline**: usa `offline-db.ts` (IndexedDB) para fila de batidas; worker de sync já existe.

- **Segurança**: JWT do `PromoterAppAuthContext`; RLS não aplicável (backend Postgres direto). Endpoints validam `employee_id` do token.

## Fora do escopo desta entrega

- Push notifications nativas (mockup mostra sino; usa polling por enquanto).
- Chat/mensagens internas.
- Assinatura digital de documentos (usa fluxo existente se solicitado depois).

## Estimativa de arquivos

- ~10 páginas novas em `src/pages/colaborador/`.
- 2 componentes de layout (Tabs, Header).
- 1 hook `use-colaborador.ts`.
- 1 rota backend nova + 3 migrations em `init-db.js`.
- Registro das rotas em `src/App.tsx`.

Aprovar para eu implementar tudo de uma vez?
