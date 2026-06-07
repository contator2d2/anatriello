
# Portal da Rede — Visão 360° por Supermercado

## Conceito

Hoje cada **PDV** tem login próprio (`supermarket_users` → `supermarket_unit_id`). Vou criar um **nível acima**: usuários **da rede inteira** (`network_id`), com painel 360° sobre todos os PDVs daquela rede.

```text
┌──────────────────────────────────────────────────────┐
│  PORTAL DA REDE  (login: network_users)              │
│  ─ Dashboard global (PDVs ativos, marcas, parceiros) │
│  ─ Solicitar novo PDV (inauguração)                  │
│  ─ Lista de PDVs + drill-down em cada um             │
│  ─ Parceiros (agências + instaladores + manutenção)  │
│  ─ Auditoria global e bloqueios em qualquer PDV      │
│  ─ Configuração de docs/IA (única, herdada por PDVs) │
└──────────────────────────────────────────────────────┘
        │
        ├── PDV 01 (login próprio, visão restrita)
        ├── PDV 02
        └── PDV N
```

## Mudanças

### 1. Banco (ensureSchema, sem migration manual)
- **`network_users`** — login da rede:
  - `network_id`, `email` (UNIQUE), `password_hash`, `name`, `role` (`admin`/`viewer`), `last_login`, `active`.
- **`pdv_inauguration_requests`** — pedidos de novo PDV pela rede:
  - `network_id`, `requested_by`, `name`, `cnpj`, `address`, `city`, `state`, `contact_*`, `expected_opening`, `notes`, `status` (`pending`/`approved`/`rejected`), `reviewed_by`, `reviewed_at`, `review_notes`, `created_unit_id`.
- **`partners`** (extensão do conceito de agência para terceiros):
  - Reaproveita tabela `agencies` adicionando coluna `partner_type` (`agency`/`installer`/`maintenance`/`other`) e `category_label`.
  - Toda lógica existente continua tratando `agencies` como entidade unificada; UI filtra por tipo.

### 2. Backend (`backend/src/routes/network-portal.js` — novo)
- Auth flexível (`network` token JWT — type `network`).
- `POST /login` `GET /me`
- `GET /dashboard` — métricas agregadas:
  - PDVs ativos / total / inativos
  - Total de promotores ativos no período
  - Total de marcas distintas atendidas (via `merch_visits` ou `agency_promoters`)
  - Total de parceiros por tipo (agency/installer/maintenance)
  - Entradas hoje / semana / mês
  - Bloqueios ativos
  - Solicitações de inauguração pendentes
- `GET /units` — todos os PDVs da rede com métricas por unidade (entradas hoje, promotores ativos, bloqueios).
- `GET /units/:id/overview` — drill-down de um PDV (logs recentes, promotores ativos, bloqueios, marcas).
- `GET /partners` — agências + terceiros operando na rede (filtro por tipo).
- `GET /brands` — marcas atendidas na rede com promotor count.
- `GET /blocks` — bloqueios em qualquer PDV da rede (delega ao `pdv-blocks`).
- `POST /inauguration-requests` `GET /inauguration-requests`
- `GET /audit` — logs de `access_audit_logs` filtrados pelos PDVs da rede.
- Reusa `dispatchNotifications` para notificar admin Ayratech sobre solicitações.

### 3. Backend (extensões pontuais)
- `agencies` ganha `partner_type` + `category_label` via `ALTER TABLE ... IF NOT EXISTS`.
- `access-control.js` lista de agências aceita query `?partner_type=` opcional.
- `supermarket_networks` continua sendo a entidade-mãe.

### 4. Frontend — novo módulo `src/pages/network/`
- `NetworkLogin.tsx` — `/rede/login`
- `NetworkLayout.tsx` — sidebar com: Dashboard, PDVs, Parceiros, Marcas, Bloqueios, Solicitações, Auditoria, Configuração
- `NetworkDashboard.tsx` — cards 360° (KPIs) + gráfico de entradas + lista resumida de PDVs
- `NetworkUnits.tsx` — tabela de PDVs com filtros; ação **"Solicitar novo PDV"**
- `NetworkUnitDetail.tsx` — drill-down por PDV
- `NetworkPartners.tsx` — agências + instaladores + manutenção (com seletor de tipo no cadastro)
- `NetworkBrands.tsx` — marcas atendidas
- `NetworkBlocks.tsx` — bloqueios em todos os PDVs
- `NetworkInaugurationRequests.tsx` — fila de pedidos
- `NetworkAudit.tsx` — auditoria consolidada
- `NetworkSettings.tsx` — configuração de docs/IA da rede (reusa `RedeDocValidationConfig`)

### 5. Frontend — contexto + hooks
- `src/contexts/NetworkAuthContext.tsx` — análogo ao de supermercado, token `network_auth_token`.
- `src/hooks/use-network-portal.ts` — todos os endpoints.
- `src/lib/api.ts` — adicionar scope para `/api/network-portal` resolver `network_auth_token`.

### 6. Admin Ayratech
- `AccessControlAdmin.tsx`: aba **"Solicitações de PDV"** para o admin aprovar/rejeitar inaugurações (cria o `supermarket_unit` automaticamente quando aprovado).
- Em **Agências**, dropdown de **Tipo de parceiro** (Agência/Instalador/Manutenção/Outro).

### 7. Rotas (`src/App.tsx`)
- `/rede/login` (público)
- `/rede/*` (protegido por `NetworkAuthContext`) — dashboard, pdvs, parceiros, marcas, bloqueios, solicitações, auditoria, configurações.

## Detalhes Técnicos

- Login da rede gera JWT `{ type: 'network', userId, networkId, orgId }`.
- `authFlex` em `pdv-blocks.js` ganha branch `network` para permitir bloquear/desbloquear qualquer PDV da rede.
- Dashboard usa queries agregadas (CTE) para evitar N+1.
- Solicitação de PDV aprovada cria registro em `supermarket_units` com `network_id` da rede e `active=false` até o admin completar dados.
- `partner_type` default `agency` para não quebrar dados existentes.

## Fora de escopo
- Não migrar usuários `supermarket_users` em massa para `network_users` (são logins diferentes).
- Não criar billing por tipo de parceiro neste loop (segue o billing existente das agências).
