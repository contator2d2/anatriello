
# SmartRoute — Reformulação: Rotas Dinâmicas + IA Noturna

## Modelo mental novo

Rotas **não são mais fixas**. São **contêineres lógicos** (ex.: "Rota Centro-SP", "Rota Zona Leste"). Todo dia os vendedores lançam **solicitações** apontando para uma dessas rotas + PDV + data. No fim do dia, um job noturno de IA pega todas as solicitações do dia seguinte, agrupa por rota, ordena respeitando as regras de cada PDV, atribui o motorista padrão e publica no app do motorista.

```text
Vendedores lançam pedidos ──► fila por (rota, data)
                                       │
                    [Cron 20h] IA organiza ordem ideal
                                       │
                    Motorista padrão atribuído ──► App do motorista (D+1)
```

## Mudanças no modelo de dados

### PDV — passa a carregar as regras
Campos adicionados em `smartroute_pdvs`:
- `delivery_window` — `manha` | `tarde` | `noite` | `qualquer`
- `allowed_weekdays` — `int[]` (0=dom … 6=sáb; default = todos)
- `checklist_template_id` — FK para checklist customizado (nullable → usa o padrão)
- `service_time_min` — tempo médio de descarga (default 15)

### Rota — vira "linha/contêiner"
Remover a lógica de `is_template`/PDVs fixos/escala semanal criada na iteração anterior. A rota agora tem apenas:
- `name`, `code`, `region`, `default_driver_id`, `default_vehicle_id`, `color`, `active`

Descartar as tabelas `smartroute_route_pdvs` e `smartroute_route_schedule` (drop com IF EXISTS na migração).

### `smartroute_route_days` — passa a ser o agendamento gerado
- `route_id`, `date`, `status` (`aberta` p/ acumular pedidos → `otimizada` pós-IA → `publicada` p/ o motorista → `em_andamento` → `concluída`)
- `driver_id`, `vehicle_id` (atribuídos automaticamente, editáveis pelo supervisor)
- `optimized_at`, `optimized_by` (`ia` | user id), `stops_summary` (jsonb com totais)

### `smartroute_orders` — solicitação de entrega
- `route_id`, `delivery_date`, `pdv_id`
- `note_number`, `volume`, `weight_kg`, `notes`, `priority`
- `sequence` (definido pela IA), `pdv_window_snapshot` (herdado do PDV no momento do lançamento)
- `owner_user_id` (vendedor)

### Checklists
Nova tabela `smartroute_pdv_checklists`:
- `pdv_id` (nullable → quando null = template global padrão), `name`, `items` (jsonb: foto/ocr/assinatura/texto/sim_nao)
- Um template default por organização; PDV pode ter o seu próprio.

## Backend

### Novos endpoints
- `GET/PUT /api/smartroute/pdvs/:id/rules` — janela, dias permitidos, checklist, tempo de descarga.
- `GET/POST/PUT /api/smartroute/checklist-templates` — CRUD do template padrão e dos customizados.
- `POST /api/smartroute/orders` — mantido; valida `pdv.allowed_weekdays.includes(weekday(delivery_date))`, ordena por `window` na hora da IA.
- `POST /api/smartroute/route-days/:route_id/:date/optimize` — dispara IA sob demanda (mesma função do cron).
- `POST /api/smartroute/route-days/:route_id/:date/publish` — publica no app do motorista.
- `POST /api/smartroute/route-days/:route_id/:date/driver` — troca motorista.

Remover os endpoints de PDVs fixos/escala semanal criados antes (route_pdvs, schedule).

### Job noturno
`backend/src/smartroute-nightly-scheduler.js` — cron 20:00 America/Sao_Paulo:
1. Para cada `(route_id, delivery_date=amanhã)` com pedidos abertos, criar/atualizar `smartroute_route_days`.
2. Rodar `optimizeRouteDay()`: ordenar por `window_rank(pdv) → nearest-neighbor(lat/lng) → prioridade`.
3. Atribuir `default_driver_id`/`default_vehicle_id` da rota (se não houver override manual).
4. Marcar `status=otimizada`, salvar `sequence` nos pedidos e `stops_summary` no dia.
5. Publicar automaticamente (`status=publicada`) → aparece no app do motorista.

Reutilizar helpers de `smartroute-planner.js` (haversine, sweep, nearest-neighbor).

### App do motorista
`GET /api/smartroute/driver/routes` — retorna `route_days` com `driver_id = req.user.id` e status ∈ (`publicada`, `em_andamento`) — sem depender mais de `driver_ids[]`.

## Frontend

### Páginas a criar/reescrever
- **`SmartRouteRotas.tsx`** (substitui `SmartRouteRotasMontadas.tsx`) — CRUD simples: nome, região, motorista padrão, veículo padrão, cor.
- **`SmartRoutePDVs.tsx`** (atualizar) — nova aba **Regras & Checklist** por PDV: janela, dias da semana permitidos, tempo de descarga, seletor de checklist (padrão do org ou custom).
- **`SmartRouteChecklistTemplates.tsx`** — novo: gerenciar template padrão e templates por PDV.
- **`SmartRoutePedidos.tsx`** (atualizar) — form pega `route_id` + `pdv_id` (filtrado pelos PDVs elegíveis à data conforme `allowed_weekdays`), mostra badge com a janela do PDV.
- **`SmartRouteRotaDoDia.tsx`** (refatorar) — passa a mostrar a rota do dia como resultado da IA, com botão **"Reotimizar"** e **"Trocar motorista"**; sem lógica de fechar/reabrir manual (o job publica automaticamente).

Descartar telas de PDVs fixos e escala semanal.

### Sidebar / rotas
- Renomear "Rotas Montadas" → "Rotas".
- Adicionar "Checklists de PDV".
- Manter "Rota do Dia" e "Pedidos".

## Documentação
Reescrever `public/docs/smartroute-documentacao.md`:
- Modelo dinâmico + IA noturna.
- Papéis: vendedor lança, IA organiza, supervisor supervisiona, motorista executa.
- Regras por PDV (janela + dias).
- Checklists template vs custom.
- Fluxo do dia: fila → cron 20h → publicação → app do motorista.
- Endpoints atualizados.

## Detalhes técnicos (para o dev)

- Migração drop-safe: `DROP TABLE IF EXISTS smartroute_route_pdvs, smartroute_route_schedule` + `ALTER TABLE smartroute_routes DROP COLUMN IF EXISTS is_template`.
- `smartroute_orders` ganha índice em `(route_id, delivery_date, sequence)`.
- Cron via `node-cron`, registrar em `backend/src/scheduler.js`.
- Otimização usa dados já existentes: `pdvs.lat/lng` + `depot` mais próximo (opcional para nearest-neighbor inicial).
- Reotimização manual chama o mesmo `optimizeRouteDay(routeId, date)`.
- Timezone `America/Sao_Paulo` em todas as datas (memória do projeto).

## Não faremos agora
- Espelho de NF-e (fase futura, mencionado).
- Rebalanceamento entre rotas (IA sugere rota B se rota A estourou capacidade) — fica como Fase 2.
- Multi-motorista por rota no mesmo dia — só quando o supervisor pedir (fora do escopo desta fase).
