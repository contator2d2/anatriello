# SmartRoute – Rotas fixas + escala + fechamento diário

Modelo novo: **rota é permanente** (não vira template). Cada dia ela tem um "estado do dia" (aberta/fechada) e uma escala de entregador(es). Pedidos são anexados à rota apontando uma data-alvo; no dia da entrega a rota é fechada e vai pro app do entregador.

## 1. Modelo de dados

Novas colunas / tabelas em `backend/schema-routes-phase4.sql` (migration incremental):

**`smartroute_routes`** (existente – adicionar):
- `is_template boolean default true` — marca que é rota-mestre permanente
- `default_driver_id uuid` — entregador padrão
- `default_vehicle_id uuid`
- `owner_user_id uuid` — vendedor/supervisor responsável (opcional)

**`smartroute_route_pdvs`** (nova) — PDVs fixos da rota:
- `route_id`, `pdv_id`, `sequence int`, `window` enum(`manha`,`tarde`,`noite`,`qualquer`), `notes`

**`smartroute_route_schedule`** (nova) — escala semanal do entregador:
- `route_id`, `weekday 0-6`, `driver_id`, `vehicle_id`

**`smartroute_route_days`** (nova) — instância diária (criada on-demand):
- `route_id`, `date`, `status` (`aberta`,`fechada`,`em_andamento`,`concluida`), `driver_ids uuid[]` (permite 2+), `vehicle_id`, `closed_at`, `closed_by`, `reopened_at`

**`smartroute_orders`** (existente – adicionar):
- `route_id uuid` (rota-mestre)
- `delivery_date date` (data-alvo)
- `pdv_window` copiada do PDV no momento do lançamento (só pra ordenar)
- `owner_user_id uuid` (vendedor que lançou)

Sequência do dia = ordena por `pdv_window` (manhã→tarde→noite→qualquer) + `sequence` do PDV na rota.

## 2. Backend (`backend/src/routes/smartroute-planner.js` + novo `smartroute-daily.js`)

Endpoints novos:
- `GET/POST/PUT/DELETE /routes/:id/pdvs` — CRUD de PDVs fixos da rota
- `GET/PUT /routes/:id/schedule` — escala semanal
- `GET /routes/:id/day?date=YYYY-MM-DD` — retorna instância do dia (cria se não existir, herdando escala + entregador padrão)
- `POST /routes/:id/day/:date/close` — fecha a rota do dia (supervisor)
- `POST /routes/:id/day/:date/reopen` — reabre
- `POST /routes/:id/day/:date/drivers` — adiciona/troca entregador(es)
- `POST /orders` (ajustar) — aceita `route_id + delivery_date + pdv_id`; grava `pdv_window`

App entregador (`/api/smartroute/driver/routes`) passa a listar `smartroute_route_days` onde `driver_ids` contém o motorista logado e `status in ('fechada','em_andamento')`.

## 3. Frontend

- **`src/pages/smartroute/RotasMontadas.tsx`** (novo) — lista rotas-mestre, editor de PDVs fixos (drag para sequência, seletor de janela), aba "Escala semanal".
- **`src/pages/smartroute/RotaDoDia.tsx`** (novo) — para uma rota + data: mostra pedidos anexados, janela de cada PDV, botão **Fechar rota**, **Reabrir**, **Adicionar entregador**.
- **Lançamento de pedido** (existente `SmartRouteOrders`): campo "Rota" + "Data da entrega" + PDV filtrado pelos PDVs da rota; janela vem preenchida.
- **Sidebar SmartRoute**: item "Rotas Montadas" e "Rota do Dia".

## 4. Regras

- Janela do PDV **só ordena** — não bloqueia.
- Fechamento: qualquer supervisor pode fechar/reabrir manualmente. Pode rodar um cron opcional depois; por ora, manual.
- Um entregador pode servir várias rotas (sem restrição de vínculo exclusivo).
- Enquanto `status='aberta'`, vendedores continuam anexando pedidos. Ao fechar, snapshot vai pro app; alterações posteriores exigem reabrir.

## 5. Compatibilidade

Rotas antigas migram com `is_template=true`. Pedidos existentes ganham `delivery_date = scheduled_date` da rota (fallback hoje). Nada é deletado.

## Fora do escopo agora

- Espelho da nota fiscal (só solicitação de rota, como você pediu).
- Importação em massa de pedidos (fase futura).
- Restrição de visibilidade por vendedor (você confirmou que vendedor vê tudo).
