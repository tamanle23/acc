import { hexToRgb } from '@/core/domain/color';
import type { AnyCanvas2DContext } from '@/lib/safe-canvas-2d';

/**
 * Algorithmic Duotone Tint Filter
 * Remaps canvas pixel luminance between shadowColor (palette.bg) and highlightColor (palette.accent)
 */
export function applyDuotoneFilter(
  ctx: AnyCanvas2DContext,
  w: number,
  h: number,
  shadowHex: string,
  highlightHex: string
): void {
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const [sR, sG, sB] = hexToRgb(shadowHex);
    const [hR, hG, hB] = hexToRgb(highlightHex);

    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const a = data[i + 3]!;
      if (a === 0) continue;

      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;

      // Standard ITU-R BT.601 perceptual luminance formula
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Linear interpolation between shadow and highlight tones
      data[i] = Math.round(sR + lum * (hR - sR));
      data[i + 1] = Math.round(sG + lum * (hG - sG));
      data[i + 2] = Math.round(sB + lum * (hB - sB));
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Headless mock or tainted canvas fallback: use dual-pass globalCompositeOperation
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = shadowHex;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = highlightHex;
    ctx.globalAlpha = 0.65;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
