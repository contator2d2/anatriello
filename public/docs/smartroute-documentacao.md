# SmartRoute AI — Documentação Completa

Guia oficial do módulo de logística e roteirização. Cobre o painel administrativo, o app do entregador e o novo modelo de **Rotas Fixas + Escala + Fechamento Diário**.

---

## 1. Visão geral

O SmartRoute organiza a operação em três camadas:

1. **Rotas Fixas (permanentes)** — cadastro-mãe de uma rota comercial. Contém os PDVs atendidos, sequência sugerida, janelas de horário e escala de entregadores por dia da semana.
2. **Pedidos / Solicitações de Entrega** — cada nota/pedido lançado pelo vendedor é vinculado a uma rota fixa + data de entrega. Não guardamos itens da nota — apenas a solicitação (o espelho da NF-e virá em fase futura).
3. **Rota do Dia** — instância diária de uma rota fixa. É onde o supervisor confere carga, fecha a rota, adiciona/troca entregadores e envia para o app.

```text
[Rota Fixa: "Rota Centro-SP"]
  ├─ PDVs fixos (com janela: manhã/tarde/noite/qualquer)
  ├─ Escala semanal (seg→dom: entregador + veículo)
  └─ Rota do Dia (por data)
        ├─ Pedidos anexados pelos vendedores
        ├─ Entregador(es) do dia
        ├─ Status: aberta → fechada → em_andamento → concluída
        └─ Vai para o app quando fechada
```

---

## 2. Papéis e permissões

| Papel | O que faz |
|---|---|
| **Vendedor** | Lança pedidos e escolhe a rota fixa + data. Vê todas as rotas (sem restrição de dono). |
| **Supervisor** | Cria/edita rotas fixas, define escala, fecha e reabre a rota do dia, troca ou adiciona entregadores. |
| **Entregador** | Recebe no app apenas as rotas do dia em que aparece na escala (ou foi adicionado manualmente) e que já estão **fechadas** ou **em andamento**. |
| **Administrador** | Configura checklists, depósitos, veículos, motoristas e integrações. |

Um entregador pode atender **várias rotas** e uma rota pode ter **mais de um entregador** no mesmo dia (definido pelo supervisor).

---

## 3. Rotas Fixas (menu **SmartRoute → Rotas Montadas**)

### 3.1 Criar uma rota fixa
1. Clique em **Nova rota**.
2. Preencha:
   - **Código/Nome** (ex.: "Rota Centro-SP", "Zona Leste — Segundas").
   - **Entregador padrão** — usado quando não houver escala definida para o dia.
   - **Veículo padrão**.
   - **Observações** (opcional).
3. Salvar.

A rota é criada como **permanente** (`is_template = true`). Ela existe todos os dias — não precisa "clonar" nem "gerar" nada.

### 3.2 PDVs fixos da rota
Aba **PDVs Fixos** dentro da rota:
- Selecione um PDV do cadastro e a **janela preferencial**:
  - `Manhã`, `Tarde`, `Noite`, `Qualquer horário`.
- Reordene com as setas ↑ ↓ — a **sequência** define a ordem sugerida no dia.
- A janela **só ordena** entregas (manhã → tarde → noite → qualquer). Não bloqueia lançamentos fora da janela.

### 3.3 Escala semanal
Aba **Escala Semanal**:
- Para cada dia (dom → sáb), escolha o entregador e o veículo.
- Deixar em branco = usa o **entregador/veículo padrão** da rota.
- Um entregador pode aparecer na escala de várias rotas.

---

## 4. Lançamento de pedidos (vendedor)

Menu **SmartRoute → Pedidos**.

1. **Nova solicitação**.
2. Selecione a **Rota fixa** — o dropdown de PDV é filtrado automaticamente para os PDVs daquela rota.
3. Escolha o **PDV** — a **janela** é herdada do cadastro (mas pode ser sobrescrita).
4. Defina a **Data de entrega**.
5. (Opcional) Observações, prioridade, referência interna.
6. Salvar.

O pedido fica anexado à rota daquela data. Enquanto a **rota do dia** estiver **aberta**, novos pedidos podem entrar. Depois de fechada, exige reabertura pelo supervisor.

> Sem espelho de NF-e nesta fase: cada pedido é apenas uma **solicitação de entrega**.

---

## 5. Rota do Dia (menu **SmartRoute → Rota do Dia**)

Instância diária de uma rota fixa. Criada automaticamente na primeira vez que alguém abre a rota para uma data.

### 5.1 O que o supervisor vê
- **Data + rota fixa** no topo.
- **Entregador(es) do dia** — herdados da escala; podem ser trocados ou complementados.
- **Veículo** — herdado da escala.
- **Sequência de entregas** — ordenada por `janela do PDV → sequência do PDV → ordem de lançamento`.
- **Status**: `aberta` · `fechada` · `em_andamento` · `concluída`.

### 5.2 Ações
| Ação | Quando usar |
|---|---|
| **Adicionar entregador** | Volume alto no dia — dois motoristas dividem a rota. |
| **Trocar entregador** | Substituição por falta/folga. |
| **Fechar rota** | Encerra o lançamento e libera no app do entregador. |
| **Reabrir rota** | Precisa incluir um pedido de última hora ou trocar entregador. |

### 5.3 Ciclo de vida
```text
aberta ──[supervisor fecha]──▶ fechada
   ▲                              │
   │                              ▼
reabrir ◀──[supervisor reabre]  em_andamento (entregador iniciou)
                                  │
                                  ▼
                              concluída (todas entregas finalizadas)
```

---

## 6. App do Entregador

O entregador vê apenas rotas do dia onde ele está na lista de entregadores e que estejam **fechada** ou **em_andamento**.

Fluxo por parada:
1. **Navegar** — abre rota no Google/Waze/Apple Maps.
2. **Check-in** — GPS + Haversine valida chegada ao PDV.
3. **Checklist** — perguntas configuráveis (foto, OCR, assinatura, texto).
4. **Finalizar** — POD (prova de entrega): assinatura + foto + CPF/RG opcional.
5. **Ocorrência** — se algo der errado, registra motivo, foto e segue.

Modo offline: check-ins, fotos e checklists ficam em fila local (`offline-db`) e sobem quando volta a conexão.

Menu inferior: **Rotas · Ponto · Avarias · Devoluções · Perfil**.

---

## 7. Checklists inteligentes

Menu **SmartRoute → Checklists**.

Tipos de item suportados:
- `foto` — obrigatória, com watermark de GPS + data.
- `ocr` — foto + análise por IA (Gemini/OpenAI, configurado em **Superadmin → IA Anatriello**) para extrair campos estruturados (JSON).
- `assinatura` — pad de assinatura no touch.
- `texto`, `numero`, `sim_nao`, `multipla_escolha`.

Checklists são vinculados por **tipo de rota**, **PDV** ou **etapa** (chegada / entrega / saída).

---

## 8. Torre de Controle e Replay

Menu **SmartRoute → Monitoramento**.

- Mapa em tempo real com todos os entregadores ativos.
- Filtros por rota, status, SLA em risco.
- **Replay**: reconstrói o percurso do dia (linha do tempo + paradas + fotos).

---

## 9. Relatórios e IA pós-rota

Ao final do dia, o motor gera automaticamente:
- Eficiência por entregador (paradas/h, km/entrega).
- Aderência à sequência sugerida.
- Ocorrências por PDV/motivo.
- Sugestões de reordenação da rota fixa quando um PDV consistentemente atrasa.

---

## 10. Modelo de dados (referência técnica)

```text
smartroute_routes            — rota fixa (is_template=true)
  ├─ default_driver_id
  ├─ default_vehicle_id
  └─ owner_user_id           — vendedor responsável (opcional)

smartroute_route_pdvs        — PDVs fixos da rota
  (route_id, pdv_id, sequence, window, notes)

smartroute_route_schedule    — escala semanal
  (route_id, weekday, driver_id, vehicle_id)

smartroute_route_days        — instância diária
  (route_id, date, status, driver_ids[], vehicle_id,
   closed_at, closed_by, reopened_at)

smartroute_orders            — pedido/solicitação
  (route_id, delivery_date, pdv_id, pdv_window,
   owner_user_id, priority, notes)
```

Regras de ordenação no dia:
`ORDER BY window_rank(pdv_window), route_pdvs.sequence, orders.created_at`
onde `window_rank`: manhã=1, tarde=2, noite=3, qualquer=4.

---

## 11. Endpoints principais

### Rotas fixas
- `GET/POST/PUT/DELETE /api/smartroute/routes` — CRUD de rotas fixas.
- `GET/POST/PUT/DELETE /api/smartroute/routes/:id/pdvs` — PDVs fixos.
- `POST /api/smartroute/routes/:id/pdvs/reorder` — reordenar.
- `GET/PUT /api/smartroute/routes/:id/schedule` — escala semanal.

### Rota do dia
- `GET /api/smartroute/routes/:id/day?date=YYYY-MM-DD` — retorna (ou cria) a instância.
- `POST /api/smartroute/routes/:id/day/:date/close` — fecha.
- `POST /api/smartroute/routes/:id/day/:date/reopen` — reabre.
- `POST /api/smartroute/routes/:id/day/:date/drivers` — define entregadores.

### Pedidos
- `POST /api/smartroute/orders` — cria pedido (`route_id + delivery_date + pdv_id`).
- `PUT /api/smartroute/orders/:id` — atualiza (bloqueado se dia fechado).

### App do entregador
- `GET /api/smartroute/driver/routes` — retorna dias com `driver_ids` contendo o motorista e status ∈ (`fechada`, `em_andamento`).

---

## 12. Perguntas frequentes

**E se um vendedor precisa lançar um pedido depois de a rota ter sido fechada?**
Peça ao supervisor para **reabrir** o dia, lance o pedido e feche novamente.

**Um entregador pode atender duas rotas no mesmo dia?**
Sim — basta aparecer na escala (ou ser adicionado manualmente) das duas rotas. O app dele mostra as duas.

**As janelas bloqueiam entregas fora do horário?**
Não. Elas apenas ordenam a sequência do dia. A regra é operacional, não travamento de sistema.

**Como funciona a auditoria?**
Toda ação (fechar, reabrir, trocar entregador, editar pedido) fica registrada com usuário, timestamp e IP. Disponível em **Monitoramento → Replay**.

**Compatibilidade com rotas antigas?**
Rotas anteriores foram migradas com `is_template=true` e seus pedidos ganharam `delivery_date = scheduled_date` (ou hoje, como fallback). Nada foi apagado.

---

_Última atualização: fase Rotas Fixas + Escala + Fechamento Diário._
