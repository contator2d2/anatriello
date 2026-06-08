## Visão geral

Construir dois fluxos novos para empresas **externas** (sem Ayratech):

1. **Auto-cadastro de agência** — público, vai pra fila de aprovação da Rede.
2. **PWA do promotor** — só controle de acesso ao PDV (NÃO é ponto), via leitura de QR fixo impresso no PDV, com validações de GPS, documentos e janela de escala.

---

## 1. Backend (Express + Postgres) — `backend/src/routes/promoter-access.js`

Um único arquivo com `ensureSchema()` (padrão do projeto). Cria/usa:

- `agency_signup_requests` — CNPJ, razão social, responsável, e-mail/senha provisórios, redes pretendidas, status (`pending|approved|rejected`), notas.
- `pdv_access_qrcodes` — `supermarket_unit_id`, `token` (UUID secreto), `active`, `printed_at`. Um QR por PDV.
- `promoter_app_users` — login do promotor (CPF + senha), vínculo `agency_promoters.id`.
- `promoter_schedules` — escala: `agency_promoter_id`, `supermarket_unit_id`, `scheduled_date`, `start_time`, `end_time`, `tolerance_min` (default 30).
- `promoter_visits` — check-in/check-out: ids, `qr_token`, `checkin_at`, `checkout_at`, GPS lat/lng + accuracy + distance_to_pdv, `validations_snapshot` jsonb (docs ok? schedule ok? gps ok?), `status` (`open|closed|denied`), `denied_reason`.

Endpoints:

| Método | Rota | Quem |
|---|---|---|
| POST | `/api/agency/signup` | público — cria signup_request |
| GET | `/api/network/agency-signups` | rede |
| POST | `/api/network/agency-signups/:id/approve` | rede — cria `agencies` + `agency_users` + envia senha |
| POST | `/api/network/agency-signups/:id/reject` | rede |
| POST | `/api/network/pdvs/:unitId/qrcode/generate` | rede — gera token novo |
| GET | `/api/network/pdvs/:unitId/qrcode/print` | rede — retorna payload p/ imprimir |
| POST | `/api/promoter-app/login` | público — CPF + senha |
| GET | `/api/promoter-app/me` | promotor — dados + escalas do dia |
| POST | `/api/promoter-app/checkin` | promotor — body `{ qr_token, lat, lng, accuracy }` → roda as 3 validações |
| POST | `/api/promoter-app/checkout` | promotor — fecha visita aberta |
| GET | `/api/promoter-app/visits` | promotor — histórico |

Lógica de validação no check-in (rejeita com motivo claro):

```text
1. QR token existe e está ativo → resolve supermarket_unit_id
2. Documentos do promotor aprovados pela Rede (consulta tabelas já existentes)
3. Escala hoje para esse PDV dentro da janela [start - tol, end + tol]
4. GPS dentro do raio do PDV (haversine vs unit.latitude/longitude, unit.radius_meters)
5. Se OK → cria promoter_visits status=open; se falhar → status=denied + denied_reason
```

Wire em `backend/src/index.js`.

---

## 2. Frontend Web — Portal público & Rede

- `src/pages/agency/AgencySignup.tsx` (rota pública `/agencia/cadastro`) — form com CNPJ, dados do responsável, e-mail/senha, seleção de redes pretendidas. Botão "Já tenho conta" → `/agencia/login`. Link da home do agencia/login.
- `src/pages/network/NetworkAgencySignups.tsx` (rota `/rede/agencias-pendentes`) — lista, aprovar/rejeitar com observação.
- `src/pages/network/NetworkQRCodes.tsx` (rota `/rede/qrcodes`) — lista de PDVs com botão "Gerar QR" e "Imprimir" (gera PNG via lib `qrcode` já no backend, abre view A4 com nome do PDV + endereço + QR).
- Itens novos no `NetworkLayout` sidebar.

---

## 3. PWA do promotor — `/p/*`

Rota separada, layout mobile-first.

- `src/pages/promoter-app/PromoterLogin.tsx` — CPF + senha.
- `src/pages/promoter-app/PromoterHome.tsx` — saudação, lista de escalas de hoje, status documental, botão grande "Escanear QR do PDV".
- `src/pages/promoter-app/PromoterScanner.tsx` — usa `@zxing/browser` (camera) para ler o QR; ao ler, pede geolocalização e dispara check-in. Mostra resultado (entrou / negado com motivo).
- `src/pages/promoter-app/PromoterVisit.tsx` — visita aberta em andamento + botão "Registrar saída".
- `src/pages/promoter-app/PromoterHistory.tsx` — histórico.
- `src/contexts/PromoterAppAuthContext.tsx` — JWT em localStorage.
- `src/hooks/use-promoter-app.ts` — fetch wrappers.

**PWA instalável** (só manifesto, sem service worker — conforme regra do projeto para promoter app):
- `public/promoter-app-manifest.webmanifest` com `start_url: /p`, `display: standalone`, ícones.
- `<link rel="manifest">` injetado só nas rotas `/p/*` via `useEffect`.

---

## 4. Migração SQL & rotas

- Cria as 5 tabelas via `ensureSchema()` na primeira chamada (padrão do backend, não usa migration Supabase).
- Adiciona dependências: `bun add @zxing/browser @zxing/library` no frontend. `qrcode` já existe no backend.

---

## Fora do escopo desta entrega

- Reconhecimento facial no PWA (você não pediu — já existe no totem).
- Push notifications.
- App nativo (Capacitor) — fica para fase posterior.

---

## Resumo de arquivos

**Criados:** 1 backend route, 1 contexto, 1 hook, 7 páginas frontend, 1 manifest, 1 SQL schema file (opcional, espelho).
**Editados:** `backend/src/index.js`, `src/App.tsx`, `src/pages/network/NetworkLayout.tsx`, `src/pages/agency/AgencyLogin.tsx` (link cadastro), `index.html` (manifest link condicional via JS).

Confirma que posso seguir com essa implementação?