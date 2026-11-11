// ============================================================================
// KINETIX STUDIO v5.0 - REAL-TIME DARKROOM & MEDIA PROCESSOR
// High-performance Canvas2D image grading (Tritone, Bayer Dither, Risograph Misregistration)
// ============================================================================

import type { PaletteTokens, DarkroomGradingMode } from '@/types/studio';
import { hexToRgb } from '@/core/domain/color';

export type { DarkroomGradingMode };

export interface DarkroomOptions {
  mode: DarkroomGradingMode;
  palette: PaletteTokens;
  misregistration?: boolean;
  misregOffset?: { x: number; y: number };
  ditherScale?: number; // 1 = 1:1 Bayer pixels, 2 = chunky retro print
}

// 8x8 Bayer Ordered Dither Matrix
const BAYER_8X8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

const MAX_DARKROOM_CACHE_SIZE = 8;
const processedCache = new Map<string, HTMLCanvasElement>();

/**
 * Clears the offscreen darkroom canvas cache to release graphics memory.
 */
export function clearDarkroomCache(): void {
  processedCache.clear();
}

/**
 * Applies studio darkroom grading to an image or canvas offscreen.
 * Returns a cached HTMLCanvasElement ready for zero-copy drawImage.
 */
export function processDarkroomGrading(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | HTMLVideoElement,
  options: DarkroomOptions,
  cacheKey?: string
): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    return source as unknown as HTMLCanvasElement;
  }

  if (cacheKey && processedCache.has(cacheKey)) {
    const cached = processedCache.get(cacheKey)!;
    // Refresh LRU position
    processedCache.delete(cacheKey);
    processedCache.set(cacheKey, cached);
    return cached;
  }

  const w = 'videoWidth' in source && source.videoWidth > 0 ? source.videoWidth : source.width;
  const h = 'videoHeight' in source && source.videoHeight > 0 ? source.videoHeight : source.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(source, 0, 0);

  const saveToCache = (c: HTMLCanvasElement) => {
    if (!cacheKey) return;
    if (processedCache.size >= MAX_DARKROOM_CACHE_SIZE) {
      const oldest = processedCache.keys().next().value;
      if (oldest !== undefined) {
        processedCache.delete(oldest);
      }
    }
    processedCache.set(cacheKey, c);
  };

  if (options.mode === 'natural') {
    saveToCache(canvas);
    return canvas;
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const len = data.length;

  const ink = hexToRgb(options.palette.ink);
  const accent = hexToRgb(options.palette.accent);
  const surface = hexToRgb(options.palette.surface);

  const ditherScale = Math.max(1, Math.round(options.ditherScale || 1));

  for (let i = 0; i < len; i += 4) {
    const alpha = data[i + 3]!;
    if (alpha === 0) continue;

    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;

    // ITU-R BT.709 relative luminance
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const pxIdx = i / 4;
    const pxX = Math.floor((pxIdx % w) / ditherScale);
    const pxY = Math.floor(Math.floor(pxIdx / w) / ditherScale);

    if (options.mode === 'duotone') {
      // Linear interpolation between ink (shadows) and accent (highlights)
      data[i] = Math.round((1 - lum) * ink[0] + lum * accent[0]);
      data[i + 1] = Math.round((1 - lum) * ink[1] + lum * accent[1]);
      data[i + 2] = Math.round((1 - lum) * ink[2] + lum * accent[2]);
    } else if (options.mode === 'tritone') {
      // Tritone: ink (shadows) -> accent (midtones) -> surface (highlights)
      if (lum < 0.5) {
        const t = lum / 0.5;
        data[i] = Math.round((1 - t) * ink[0] + t * accent[0]);
        data[i + 1] = Math.round((1 - t) * ink[1] + t * accent[1]);
        data[i + 2] = Math.round((1 - t) * ink[2] + t * accent[2]);
      } else {
        const t = (lum - 0.5) / 0.5;
        data[i] = Math.round((1 - t) * accent[0] + t * surface[0]);
        data[i + 1] = Math.round((1 - t) * accent[1] + t * surface[1]);
        data[i + 2] = Math.round((1 - t) * accent[2] + t * surface[2]);
      }
    } else if (options.mode === 'risograph') {
      // 8x8 Bayer Ordered Dither Quantization
      const bayerVal = BAYER_8X8[(pxY % 8) * 8 + (pxX % 8)]!;
      const threshold = (bayerVal + 0.5) / 64;

      if (lum >= threshold) {
        data[i] = surface[0];
        data[i + 1] = surface[1];
        data[i + 2] = surface[2];
      } else {
        data[i] = ink[0];
        data[i + 1] = ink[1];
        data[i + 2] = ink[2];
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // If misregistration is active, composite a shifted accent plate
  if (options.misregistration) {
    const shiftX = options.misregOffset?.x ?? 2.5;
    const shiftY = options.misregOffset?.y ?? 1.8;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.45;
    ctx.drawImage(canvas, shiftX, shiftY);
    ctx.restore();
  }

  saveToCache(canvas);
  return canvas;
}
