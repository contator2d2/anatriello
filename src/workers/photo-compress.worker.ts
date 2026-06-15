/* eslint-disable no-restricted-globals */
// Web Worker para comprimir imagens em WebP fora da main thread.
// Recebe um ImageBitmap + parâmetros, devolve um Blob.
//
// Fallback: se o navegador não suporta OffscreenCanvas / convertToBlob,
// o chamador deve cair pro caminho síncrono no main thread.

type CompressMessage = {
  bitmap: ImageBitmap;
  quality: number;
  maxSizeKb: number;
  width: number;
  height: number;
};

self.onmessage = async (e: MessageEvent<CompressMessage>) => {
  const { bitmap, quality, maxSizeKb, width, height } = e.data;
  try {
    // @ts-ignore — OffscreenCanvas existe em workers modernos
    const canvas: OffscreenCanvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // @ts-ignore
      self.postMessage({ error: 'no-2d-context' });
      return;
    }
    // @ts-ignore
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let q = quality;
    let blob: Blob | null = null;
    for (let i = 0; i < 5; i++) {
      // @ts-ignore — convertToBlob é parte da spec de OffscreenCanvas
      blob = await canvas.convertToBlob({ type: 'image/webp', quality: q });
      if (!blob) break;
      if (blob.size / 1024 <= maxSizeKb) break;
      q = Math.max(0.1, q - 0.1);
    }

    if (!blob) {
      // @ts-ignore
      self.postMessage({ error: 'no-blob' });
      return;
    }

    // @ts-ignore
    self.postMessage({ blob });
  } catch (err: any) {
    // @ts-ignore
    self.postMessage({ error: err?.message || String(err) });
  }
};

export {};
