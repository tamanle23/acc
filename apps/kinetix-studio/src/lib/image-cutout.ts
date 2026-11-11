// ============================================================================
// KINETIX STUDIO v5.0 - CANVAS SMART IMAGE CUTOUT FOR 2.5D BREAKOUT
// Client-side luminance & chroma edge isolation for user product & portrait photos
// to allow focal subjects to pop beyond stage window boundaries.
// ============================================================================

import { saveAsset, getAsset } from './asset-store';

export interface ImageCutoutResult {
  key: string;
  dataUrl: string;
  width: number;
  height: number;
}

export async function processImageCutout(
  file: File,
  threshold = 0.15
): Promise<ImageCutoutResult> {
  const imgBitmap = await createImageBitmap(file);
  const w = imgBitmap.width;
  const h = imgBitmap.height;

  // Max dimension 1024 for high-performance canvas composition
  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.drawImage(imgBitmap, 0, 0, targetW, targetH);
  imgBitmap.close();

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;

  // Sample corner pixel as background reference tone
  const refR = (data[0]! + data[(targetW - 1) * 4]!) / 2;
  const refG = (data[1]! + data[(targetW - 1) * 4 + 1]!) / 2;
  const refB = (data[2]! + data[(targetW - 1) * 4 + 2]!) / 2;

  const tol = threshold * 255;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const diff = Math.sqrt(
      (r - refR) * (r - refR) +
      (g - refG) * (g - refG) +
      (b - refB) * (b - refB)
    );

    if (diff < tol) {
      data[i + 3] = 0; // Transparent background
    } else if (diff < tol * 1.35) {
      // Soft antialiased feathered boundary
      const alphaFactor = (diff - tol) / (tol * 0.35);
      data[i + 3] = Math.round(data[i + 3]! * alphaFactor);
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const key = `cutout_${Date.now()}`;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob) {
    await saveAsset(key, blob, 'image', file.name, 'image/png');
  }

  const dataUrl = canvas.toDataURL('image/png');
  return {
    key,
    dataUrl,
    width: targetW,
    height: targetH,
  };
}

const cutoutCache = new Map<string, HTMLImageElement>();
const pendingCutoutPromises = new Map<string, Promise<HTMLImageElement | null>>();

export function getCutoutImageSync(key: string): HTMLImageElement | null {
  return cutoutCache.get(key) ?? null;
}

export async function getCutoutImage(key: string): Promise<HTMLImageElement | null> {
  if (cutoutCache.has(key)) return cutoutCache.get(key)!;
  if (pendingCutoutPromises.has(key)) return pendingCutoutPromises.get(key)!;

  const promise = (async () => {
    try {
      const record = await getAsset(key);
      if (!record || !(record.data instanceof Blob)) return null;

      return await new Promise<HTMLImageElement | null>((resolve) => {
        const url = URL.createObjectURL(record.data as Blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          cutoutCache.set(key, img);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });
    } catch {
      return null;
    } finally {
      pendingCutoutPromises.delete(key);
    }
  })();

  pendingCutoutPromises.set(key, promise);
  return promise;
}
