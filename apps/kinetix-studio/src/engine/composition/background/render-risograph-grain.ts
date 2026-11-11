import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

/**
 * 3. Risograph Stipple
 * Tactile paper tooth texture and stochastic stipple ink spray.
 */
export function renderRisographGrain({
  sctx,
  w,
  h,
  palette,
  scaleFactor,
}: BackgroundGeneratorOptions): void {
  sctx.save();

  // Pseudo-random deterministic stipple points
  const points = 320;
  for (let i = 0; i < points; i++) {
    // Deterministic pseudo-random sequence
    const sx = (Math.sin(i * 127.1) * 43758.5453) % 1;
    const sy = (Math.cos(i * 311.7) * 43758.5453) % 1;
    const x = Math.abs(sx) * w;
    const y = Math.abs(sy) * h;

    const r = (0.8 + Math.abs(Math.sin(i)) * 1.6) * scaleFactor;
    sctx.beginPath();
    sctx.fillStyle = i % 2 === 0 ? palette.accent : palette.ink;
    sctx.globalAlpha = 0.08 + Math.abs(Math.sin(i * 2)) * 0.18;
    sctx.arc(x, y, r, 0, Math.PI * 2);
    sctx.fill();
  }

  sctx.restore();
}
