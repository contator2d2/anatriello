// Helpers de performance para captura de fotos no app do promotor.
// - Cache de geolocalização (evita esperar GPS a cada foto)
// - Pré-aquecimento de conexão TLS com o endpoint de upload
// - Wrapper de compressão WebP em Web Worker com fallback main-thread

import { API_URL } from '@/lib/api';
import { logger } from '@/lib/logger';

// ---------- Geolocalização cacheada ----------
type CachedPos = { lat: number; lng: number; at: number };
let _cachedPos: CachedPos | null = null;
let _inflight: Promise<CachedPos | null> | null = null;
const POS_TTL_MS = 90_000; // 90s

export async function getCachedGeolocation(options?: {
  ttlMs?: number;
  timeoutMs?: number;
}): Promise<{ lat?: number; lng?: number }> {
  const ttl = options?.ttlMs ?? POS_TTL_MS;
  const timeout = options?.timeoutMs ?? 2500;
  const now = Date.now();
  if (_cachedPos && now - _cachedPos.at < ttl) {
    return { lat: _cachedPos.lat, lng: _cachedPos.lng };
  }
  if (!('geolocation' in navigator)) return {};
  if (_inflight) {
    const r = await _inflight;
    return r ? { lat: r.lat, lng: r.lng } : {};
  }
  _inflight = new Promise<CachedPos | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const v: CachedPos = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          at: Date.now(),
        };
        _cachedPos = v;
        resolve(v);
      },
      () => resolve(_cachedPos ?? null), // se falhar, devolve último cache (mesmo expirado) ou null
      { enableHighAccuracy: false, timeout, maximumAge: ttl }
    );
  }).finally(() => {
    _inflight = null;
  });
  const r = await _inflight;
  return r ? { lat: r.lat, lng: r.lng } : {};
}

/** Dispara um fetch em background pra povoar o cache (não bloqueia). */
export function warmGeolocation() {
  getCachedGeolocation().catch(() => {});
}

// ---------- Pré-aquecimento de conexão ----------
let _lastPrewarm = 0;
export function prewarmUploadConnection() {
  const now = Date.now();
  if (now - _lastPrewarm < 30_000) return; // no máximo 1x a cada 30s
  _lastPrewarm = now;
  try {
    // HEAD pode não ser suportado; GET no /api/health é leve.
    fetch(`${API_URL}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* silent */
  }
}

// ---------- Compressão WebP (worker + fallback) ----------
let _worker: Worker | null = null;
let _workerBroken = false;

function getWorker(): Worker | null {
  if (_workerBroken) return null;
  if (_worker) return _worker;
  try {
    _worker = new Worker(
      new URL('../workers/photo-compress.worker.ts', import.meta.url),
      { type: 'module' }
    );
    return _worker;
  } catch (err: any) {
    logger.warn('[photo-perf] worker indisponível, usando fallback', { error: err?.message });
    _workerBroken = true;
    return null;
  }
}

async function compressInWorker(
  canvas: HTMLCanvasElement,
  quality: number,
  maxSizeKb: number
): Promise<Blob | null> {
  const w = getWorker();
  if (!w) return null;
  if (typeof (canvas as any).transferControlToOffscreen !== 'function' &&
      typeof (window as any).OffscreenCanvas === 'undefined') {
    return null;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(canvas);
  } catch {
    return null;
  }
  return new Promise<Blob | null>((resolve) => {
    const onMessage = (e: MessageEvent<any>) => {
      w.removeEventListener('message', onMessage);
      if (e.data?.blob instanceof Blob) resolve(e.data.blob);
      else resolve(null);
    };
    w.addEventListener('message', onMessage);
    try {
      w.postMessage(
        { bitmap, quality, maxSizeKb, width: canvas.width, height: canvas.height },
        [bitmap]
      );
    } catch (err) {
      w.removeEventListener('message', onMessage);
      _workerBroken = true;
      resolve(null);
    }
  });
}

function compressMainThread(
  canvas: HTMLCanvasElement,
  quality: number,
  maxSizeKb: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    let q = quality;
    const attempt = (currentQuality: number, attemptsLeft: number) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          if (blob.size / 1024 <= maxSizeKb || attemptsLeft <= 0) return resolve(blob);
          attempt(currentQuality - 0.1, attemptsLeft - 1);
        },
        'image/webp',
        currentQuality
      );
    };
    attempt(q, 5);
  });
}

export async function compressWebP(
  canvas: HTMLCanvasElement,
  quality: number,
  maxSizeKb: number
): Promise<Blob | null> {
  const viaWorker = await compressInWorker(canvas, quality, maxSizeKb);
  if (viaWorker) return viaWorker;
  return compressMainThread(canvas, quality, maxSizeKb);
}
