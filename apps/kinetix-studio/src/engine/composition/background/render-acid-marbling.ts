import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

/**
 * 9. Acid Marbling
 * Fluid psychedelic paper marbling ribbon swirls using trigonometric stream function.
 */
export function renderAcidMarbling({
  sctx,
  w,
  h,
  palette,
  theta,
  motion,
}: BackgroundGeneratorOptions): void {
  const drift = motion ? theta * 0.22 : 0;
  const numBands = 8;

  sctx.save();
  sctx.lineWidth = 2.5;

  for (let i = 0; i < numBands; i++) {
    const frac = i / numBands;
    const baseY = h * (0.15 + frac * 0.7);

    sctx.beginPath();
    sctx.strokeStyle = i % 2 === 0 ? palette.accent : palette.accent2;
    sctx.globalAlpha = 0.25 + 0.25 * Math.sin(drift + i);

    for (let x = 0; x <= w; x += 18) {
      // Swirling stream function
      const u = x * 0.015;
      const swirl1 = Math.sin(u + drift + Math.cos(u * 0.5 + i)) * 32;
      const swirl2 = Math.cos(u * 1.8 - drift * 0.7) * 16;
      const y = baseY + swirl1 + swirl2;

      if (x === 0) sctx.moveTo(x, y);
      else sctx.lineTo(x, y);
    }
    sctx.stroke();
  }

  sctx.restore();
}
