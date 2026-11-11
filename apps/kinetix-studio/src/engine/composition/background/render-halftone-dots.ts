import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

/**
 * 2. Halftone Screen
 * Editorial screenprint dot raster with variable radii responding to radial distance.
 */
export function renderHalftoneDots({
  sctx,
  w,
  h,
  palette,
  theta,
  motion,
  scaleFactor,
}: BackgroundGeneratorOptions): void {
  const drift = motion ? theta * 0.2 : 0;
  const cols = 26;
  const rows = 36;
  const stepX = w / cols;
  const stepY = h / rows;
  const maxR = Math.min(stepX, stepY) * 0.44;

  const cx = w * 0.5;
  const cy = h * 0.45;

  sctx.save();
  sctx.fillStyle = palette.accent;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = (c + 0.5) * stepX;
      const py = (r + 0.5) * stepY;

      // Distance from center
      const dist = Math.hypot(px - cx, py - cy);
      const normDist = dist / (Math.max(w, h) * 0.65);
      const wave = Math.sin(normDist * 5 - drift);

      const rad = Math.max(0.8 * scaleFactor, maxR * Math.abs(wave) * (1 - normDist * 0.4));

      sctx.beginPath();
      sctx.globalAlpha = 0.15 + 0.45 * Math.abs(wave);
      sctx.arc(px, py, rad, 0, Math.PI * 2);
      sctx.fill();
    }
  }

  sctx.restore();
}
