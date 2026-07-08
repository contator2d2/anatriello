## Objetivo

Transformar o SmartRoute AI de um gerador de rotas em um **controlador de jornada operacional** ponta-a-ponta. Cada entrega vira uma máquina de estados com validações configuráveis, e a próxima só é liberada após o Check-out atender todos os requisitos obrigatórios.

## Máquina de estados por entrega (stop)

```text
PENDING → NAVIGATING → ARRIVED → CHECKED_IN
  → CHECKLIST_IN_PROGRESS → CHECKLIST_DONE
  → PROOF_CAPTURED → SIGNED → CHECKED_OUT → COMPLETED
                                          ↘ EXCEPTION (com ocorrência)
```

Regras: um stop só avança de estado quando todos os itens obrigatórios daquele passo estão preenchidos. A rota só libera o próximo stop quando o atual está em `COMPLETED` ou `EXCEPTION` justificada.

## Entidades novas (backend)

Prefixo `sr_` (SmartRoute), no schema `public`, com GRANTs e RLS conforme padrão do projeto.

- `sr_checklist_templates` — nome, escopo (cliente/tipo/canal/categoria/produto/região/equipamento/operação), ativo.
- `sr_checklist_template_items` — ordem, tipo de campo (`photo`, `video`, `text`, `number`, `temperature`, `stock_count`, `ocr`, `qr`, `barcode`, `signature`, `geo`, `face`, `yes_no`, `multi_choice`), obrigatório, config JSONB (min/max, opções, tolerância GPS, etc.).
- `sr_checklist_assignments` — regras de vinculação por atributo do PDV (cliente_id, tipo, canal, categoria, região, equipamento, operação, produto). O motor escolhe o(s) template(s) aplicáveis no momento da entrega.
- `sr_stops` — reforço do stop atual: `state`, `checkin_at`, `checkin_lat/lng`, `checkin_photo_url`, `checkout_at`, `distance_ok`, `template_snapshot_id`, `duration_ms`.
- `sr_stop_checklist_responses` — resposta por item (valor, mídia, ocr_json, coords, timestamps).
- `sr_stop_media` — fotos/vídeos/áudios com EXIF (lat, lng, taken_at, device).
- `sr_stop_occurrences` — tipo (danificado, vencido, recusado, ausente, garantia, devolução, descarte, equipamento, freezer, outros), descrição, mídias, geo.
- `sr_stop_ocr_results` — produto, marca, código, EAN, lote, fabricação, validade, confiança da IA, ligação com stop e mídia origem.
- `sr_journey_events` — log append-only de tudo (auditoria/replay do gestor).

Todas as tabelas: `GRANT` para `authenticated` + `service_role`, `ENABLE RLS`, policies por `organization_id`.

## Endpoints REST (backend/src/routes/smartroute-driver.js e novos)

- `POST /api/sr/journey/start` — inicia jornada do dia (checklist do veículo opcional).
- `GET  /api/sr/journey/today` — resumo (nº entregas, km, tempo, veículo, produtos, ordem).
- `POST /api/sr/stops/:id/navigate` — marca `NAVIGATING`, retorna deep link Google Maps/Waze.
- `POST /api/sr/stops/:id/checkin` — valida distância GPS (config por org, padrão 30 m), aceita foto de fachada com EXIF.
- `GET  /api/sr/stops/:id/checklist` — resolve templates aplicáveis e devolve itens ordenados.
- `POST /api/sr/stops/:id/checklist/items/:itemId` — grava resposta (com upload de mídia via bucket).
- `POST /api/sr/stops/:id/ocr` — recebe imagem, chama Lovable AI (Gemini multimodal) e devolve produto/lote/validade/EAN estruturados.
- `POST /api/sr/stops/:id/occurrence` — registra ocorrência.
- `POST /api/sr/stops/:id/signature` — assinatura base64 do cliente.
- `POST /api/sr/stops/:id/checkout` — valida obrigatórios, fecha stop, calcula duração, libera próximo.
- `GET  /api/sr/stops/:id/next` — devolve próximo stop e deep link de navegação.

## Motor de validação (backend)

Serviço `sr-validation.js`:
- Resolve templates aplicáveis (interseção de escopos).
- Faz snapshot do template no `sr_stops` para não quebrar histórico se admin editar depois.
- Bloqueia transições de estado quando obrigatórios faltam; retorna lista amigável de pendências.
- Distância GPS: Haversine entre check-in e PDV, com tolerância configurável.

## OCR de embalagens

- Provider: Lovable AI Gateway (`google/gemini-3.1-flash-image` ou `-flash` para JSON estruturado).
- Prompt fixo pedindo JSON: `{ product, brand, code, ean, batch, manufactured_at, expires_at, confidence }`.
- Client-side: chamado após cada foto marcada com `ocr: true` no template; resultado exibido para o entregador confirmar/corrigir antes de gravar.

## Frontend — App do Entregador

Novas telas em `src/pages/entregador/`:
- `EntregadorJornada.tsx` — resumo do dia + botão "Iniciar operação".
- `EntregadorEntrega.tsx` — tela principal do stop atual, dividida em abas: **Navegar**, **Check-in**, **Checklist**, **Ocorrências**, **Finalizar**.
- `components/entregador/`:
  - `CheckinCard.tsx` (GPS + foto de fachada + validação).
  - `ChecklistRunner.tsx` (renderiza itens por tipo).
  - `field-types/` (um componente por tipo: PhotoField, VideoField, NumberField, TemperatureField, StockCountField, OcrField, QrField, BarcodeField, SignatureField, GeoField, FaceField, YesNoField, MultiChoiceField).
  - `OccurrenceSheet.tsx` (bottom-sheet para registrar ocorrência).
  - `SignaturePad.tsx` (canvas).
  - `NextStopBanner.tsx` (aparece após check-out, com contagem regressiva e botão "Navegar").
- Hook `use-smartroute-journey.ts` (React Query) para todos os endpoints acima.
- Deep links: `google.navigation:q=lat,lng` (Android) e `comgooglemaps://` / `waze://` (iOS), com fallback web `https://www.google.com/maps/dir/?api=1&destination=...`.
- Suporte offline: fila local (IndexedDB via `offline-db.ts` existente) para mídias/respostas, sincroniza ao voltar rede — reaproveita `use-offline-sync`.

## Frontend — Admin (SmartRoute)

Nova página `src/pages/smartroute/SmartRouteChecklists.tsx`:
- Editor drag-and-drop de templates com preview mobile.
- Aba de **Vinculação** (regras por cliente/tipo/canal/categoria/região/equipamento/operação/produto).
- Aba **Simulação**: escolhe um PDV/pedido e mostra qual checklist seria aplicado.

Enriquecer `SmartRouteReplay.tsx` para exibir eventos da jornada (checkins, fotos, OCR, ocorrências, checkout) na timeline existente.

Adicionar cards no `SmartRouteDashboard.tsx`: entregas em andamento por estado, tempo médio por stop, taxa de ocorrências, checklists com maior falha.

## Configurações por organização

Em `SmartRouteConfiguracoes.tsx` adicionar bloco "Operação":
- Distância máxima de check-in (default 30 m).
- Exigir foto de fachada (sim/não).
- Exigir checklist do veículo no início do dia (sim/não).
- App de navegação preferido (Google Maps / Waze / perguntar).
- Permitir check-out com ocorrência (sim/não).

## Storage

Bucket privado `smartroute-media` (fotos, vídeos, áudios, assinaturas). Upload assinado pelo backend; policies por `organization_id` e `stop_id`.

## Ordem de entrega (3 ondas)

**Onda 1 — Fundação**
Migração completa (`sr_*`), motor de validação, endpoints de jornada/check-in/checkout, tela `EntregadorJornada` + `EntregadorEntrega` com Navegar, Check-in e Finalizar (foto NF + assinatura + checkout). Sem checklists customizados ainda — só campos padrão.

**Onda 2 — Checklists configuráveis + OCR**
Templates, vinculação por escopo, `ChecklistRunner` com todos os tipos de campo, integração OCR via Lovable AI, `SmartRouteChecklists.tsx` (editor + simulação).

**Onda 3 — Ocorrências, offline, replay e dashboard**
`OccurrenceSheet`, fila offline, timeline no `SmartRouteReplay`, cards operacionais no Dashboard, configurações da organização.

## Detalhes técnicos importantes

- Fuso `America/Sao_Paulo` em todos os timestamps exibidos (usar helpers `br-utils`, evitar `toISOString`).
- Reaproveitar `ensureTables` (padrão do projeto) para JIT das novas tabelas antes de I/O.
- Reaproveitar `WebGL + fallback CPU` do face-api.js quando `field-type: face` for usado.
- Deep link de navegação nunca abre em nova aba dentro do WebView — usa `window.location.href` com o scheme nativo.
- Todas as mídias armazenam EXIF (lat, lng, taken_at) — se faltar, backend recusa com mensagem clara.
- Snapshot do template no stop garante que edições futuras do admin não retroagem em entregas já iniciadas.

## Fora de escopo desta entrega

- Roteirização em si (já existe).
- Integração com ERPs externos (fica em `SmartRouteIntegracoes`).
- Cobrança/financeiro do entregador.
