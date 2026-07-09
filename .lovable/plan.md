
## Objetivo

Deixar o app do entregador com barra inferior (padrão promotor) e habilitar 4 funções operacionais que geram registro no sistema:

1. Check-in de parada (já existe — só ganha atalho na bottom nav)
2. Ponto (bater ponto de jornada — entrada, pausa, retorno, saída)
3. Avarias (dano na carga/embalagem, com foto e vínculo opcional à parada/rota)
4. Devolução (recusa/troca do cliente, itens devolvidos, motivo, foto)

Cada evento fica salvo em tabela dedicada e aparece no monitoramento (Torre) e nos relatórios da rota.

## UX do app

- Nova `DriverBottomNav` fixa em todas as telas autenticadas do entregador (`/entregador/*`) com 5 ícones:
  Início · Ponto · Avaria · Devolução · Histórico
- Telas novas: `EntregadorPonto`, `EntregadorAvaria`, `EntregadorDevolucao`, `EntregadorHistorico`.
- Fluxo padrão de cada registro: escolher rota/parada atual (opcional), foto obrigatória, motivo/tipo, observação, GPS automático → confirmação com toast.

## Backend

Novas tabelas em `smartroute-driver.js` (via ensureTables no boot da rota):

```text
smartroute_driver_timeclock       (punches: entrada/pausa/retorno/saida + gps + foto)
smartroute_cargo_damages          (avarias com stop_id opcional, tipo, severidade, fotos, gps)
smartroute_delivery_returns       (devoluções com stop_id, motivo, itens jsonb, fotos, gps)
```

Endpoints (prefix `/api/smartroute/driver`):

- `POST /timeclock/punch` `{ kind, lat, lng, photo? }` · `GET /timeclock/today`
- `POST /damages` `{ stop_id?, route_id?, type, severity, description, photos[], lat, lng }` · `GET /damages/mine`
- `POST /returns` `{ stop_id, reason, items[], photos[], lat, lng }` · `GET /returns/mine`
- `GET /history?date=` — lista consolidada dos últimos eventos do entregador

Todos exigem o middleware `driverAuth` já existente e escrevem em `smartroute_journey_events` para aparecer no Replay/Torre.

## Integração com o sistema

- `SmartRouteMonitoramento` (Torre): novo filtro/aba mostrando avarias e devoluções em tempo real.
- `SmartRouteOcorrencias`: passa a agregar avarias/devoluções (mesma view de KPIs).
- `RHPontoMonitor`: os punches do entregador aparecem como fonte "SmartRoute" no monitor de ponto para conferência do RH (leitura simples, sem duplicar cartão).

## Arquivos previstos

Frontend
- `src/components/entregador/DriverBottomNav.tsx` (novo)
- `src/pages/entregador/EntregadorPonto.tsx` (novo)
- `src/pages/entregador/EntregadorAvaria.tsx` (novo)
- `src/pages/entregador/EntregadorDevolucao.tsx` (novo)
- `src/pages/entregador/EntregadorHistorico.tsx` (novo)
- `src/pages/entregador/EntregadorHome.tsx` (adiciona bottom nav + cards de resumo)
- `src/pages/entregador/EntregadorRota.tsx` / `EntregadorEntrega.tsx` (bottom nav + atalhos)
- `src/App.tsx` (novas rotas `/entregador/ponto|avaria|devolucao|historico`)

Backend
- `backend/src/routes/smartroute-driver.js` (ensureTables + novos endpoints)
- `backend/src/routes/smartroute-ops.js` (leitura consolidada p/ Torre — pequeno ajuste)

## Fora do escopo

- Aprovação/fluxo financeiro de devolução (fica só o registro operacional).
- Integração eSocial do ponto do entregador (usa somente o monitor operacional).
