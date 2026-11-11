import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

/**
 * 8. Minimal Film Grain Veil
 * Clean, subtle optical cinema grain distribution.
 */
export function renderMinimalNoise({
  sctx,
  w,
  h,
  palette,
  scaleFactor,
}: BackgroundGeneratorOptions): void {
  sctx.save();

  // Dense subtle micro-grain field
  const dots = 260;
  for (let i = 0; i < dots; i++) {
    const rx = (Math.sin(i * 91.3) * 37461.23) % 1;
    const ry = (Math.cos(i * 53.7) * 49281.42) % 1;
    const x = Math.abs(rx) * w;
    const y = Math.abs(ry) * h;

    sctx.fillStyle = palette.ink;
    sctx.globalAlpha = 0.04 + Math.abs(Math.sin(i * 1.5)) * 0.08;
    sctx.fillRect(x, y, 1.2 * scaleFactor, 1.2 * scaleFactor);
  }

  sctx.restore();
}
