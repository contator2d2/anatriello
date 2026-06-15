# Sistema de Captura e Upload de Fotos — App do Promotor

> **Documento de baseline** — captura o comportamento **anterior** à otimização de performance (#1–#5).
> Mantido como referência para rollback e para validação de regressões.

## 1. Visão geral

A captura de fotos no app do promotor é centralizada no componente `src/components/promotor/CameraCapture.tsx`. Esse componente é reusado em:

- `PromotorRota.tsx` — fotos de categoria (antes/depois), ponto extra, produtos
- `PromotorAvarias.tsx` / `MerchPerdas.tsx` — fotos de avaria/descarte (Perdas)
- `PromotorPesquisaPreco.tsx` — fotos de pesquisa de preço
- Demais checklists do promotor

## 2. Configuração de qualidade (padrão)

Definida em `DEFAULT_QUALITY_CONFIG`:

| Parâmetro              | Valor padrão | Descrição                                              |
|------------------------|--------------|--------------------------------------------------------|
| `blur_tolerance`       | 30           | Variância mínima do Laplaciano (menor = mais permissivo na verdade — quanto MAIOR, mais nítido exigido). |
| `min_brightness`       | 40           | Brilho médio mínimo (0–255).                          |
| `max_brightness`       | 220          | Brilho médio máximo (0–255).                          |
| `min_resolution_w`     | 640          | Largura mínima em pixels.                              |
| `min_resolution_h`     | 480          | Altura mínima em pixels.                               |
| `compression_quality`  | 0.7          | Qualidade WebP inicial (0–1).                          |
| `max_file_size_kb`     | 1024         | Tamanho máximo do arquivo comprimido (KB).             |

A câmera é solicitada com `width: { ideal: 1920 }, height: { ideal: 1080 }` e `facingMode: "environment"` por padrão.

## 3. Fluxo de captura (baseline — síncrono)

```
[Promotor abre câmera]
   ↓ flushSync(setIsOpen) + getUserMedia (mesmo gesto, requisito iOS)
[Video preview]
   ↓ clica botão capturar
[canvas.drawImage(video)]
   ↓ analyzeImageQuality() — resolução, brilho, blur (Laplaciano)
   ↓ se inválida → mostra erro, refazer
[Preview da foto capturada — toDataURL JPEG 0.95]
   ↓ clica Aprovar (handleAccept)
   ┌─ 1. await getCurrentPosition (enableHighAccuracy: true, timeout 5000ms)   ◀── BLOQUEIA ATÉ 5s
   ├─ 2. applyWatermark(canvas) — PDV, marca, promotor, data/hora, tipo, GPS
   ├─ 3. await compressToWebP(canvas, q, maxKb)  — até 5 tentativas reduzindo q em 0.1
   ├─ 4. await uploadFile(file)  ◀── BLOQUEIA ATÉ O SERVIDOR RESPONDER
   │     └─ se falhar OU offline → queueUpload (IndexedDB via Dexie)
   └─ 5. onCapture(finalUrl) → fecha diálogo
```

**Tempo total bloqueante percebido pelo promotor:** captura → aprovar → fechado.
Em rede ruim no PDV (3G/4G fraco): 5–15s por foto.

## 4. Hooks envolvidos

### `useUpload` (`src/hooks/use-upload.ts`)
- Limite: 100MB.
- `uploadFile(file)` → `POST /api/uploads` (multipart), retorna URL absoluta.
- Síncrono do ponto de vista do chamador (Promise).

### `useOfflineSync` (`src/hooks/use-offline-sync.ts`)
- Persiste pendências em IndexedDB (Dexie): `pending_uploads`, `pending_api_calls`, `upload_mappings`.
- `queueUpload(file, token)` → grava upload, retorna `local-file://<localId>`.
- `queueApiCall(config)` → grava chamada API.
- `sync()` — processa pendências **sequencialmente** (1 upload por vez, depois 1 API call por vez).
- Auto-sync quando volta online (`navigator.onLine`).
- Resolve `local-file://` em chamadas API quando upload conclui via `upload_mappings`.

## 5. Watermark

Texto preto sobre faixa semitransparente no rodapé:
- PDV, Marca, Promotor, `dd/mm/aaaa HH:MM:SS`, Tipo, `GPS: lat, lng` (5 casas).
- Timestamp também no canto superior direito.
- Fonte: `bold {fontSize}px sans-serif`, `fontSize = max(12, floor(w * 0.025))`.

## 6. Validação de qualidade

`analyzeImageQuality(canvas, config)`:
1. **Resolução:** rejeita se `w < min_resolution_w` ou `h < min_resolution_h`.
2. **Amostragem:** crop central de até 200×150 px para acelerar.
3. **Brilho médio:** luminância ponderada Rec. 601, passo de 4 pixels.
4. **Blur:** variância do Laplaciano 4-conexo, passo 2 pixels.
5. Mensagens em pt-BR retornadas para a UI.

## 7. Compressão

`compressToWebP(canvas, quality, maxSizeKb)`:
- Formato: `image/webp`.
- Loop: até 5 tentativas reduzindo `quality` em 0.1 até caber em `maxSizeKb`.
- Roda no thread principal (UI pode travar em dispositivos fracos).

## 8. Geolocalização

- Chamada a cada `handleAccept` (cada foto).
- `enableHighAccuracy: true`, `timeout: 5000`.
- Erro silencioso (foto segue sem GPS).

## 9. Pontos de gargalo identificados

| # | Gargalo                                                            | Impacto |
|---|--------------------------------------------------------------------|---------|
| 1 | `await uploadFile` bloqueia o diálogo até o servidor responder.    | Alto    |
| 2 | `getCurrentPosition` bloqueia até 5s a cada foto.                  | Alto    |
| 3 | Compressão WebP no thread principal trava a UI em devices fracos.  | Médio   |
| 4 | TLS/handshake feito sob demanda no primeiro upload.                | Baixo   |
| 5 | Fila offline envia uploads **sequencialmente** (1 por vez).        | Médio   |

## 10. Próxima fase (otimização)

Ver commit subsequente e o próprio código: as melhorias 1–5 implementam upload otimista em background, cache de geolocalização, compressão em Web Worker, pré-aquecimento da conexão e fila concorrente.

## 11. Como reverter

```
git revert <hash-da-otimização>
```
ou consultar a versão deste arquivo em `docs/promotor-upload-fotos.md` no commit imediatamente anterior à otimização.
