import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

/**
 * 6. Topographic Elevation Contours
 * Smooth elevation isolines undulating gently across the poster backdrop.
 */
export function renderTopoContours({
  sctx,
  w,
  h,
  palette,
  theta,
  motion,
}: BackgroundGeneratorOptions): void {
  const drift = motion ? theta * 0.18 : 0;
  const numLines = 14;
  const stepY = h / (numLines + 1);

  sctx.save();
  sctx.lineWidth = 1.2;

  for (let i = 1; i <= numLines; i++) {
    const baseY = i * stepY;
    const isMajor = i % 4 === 0;

    sctx.beginPath();
    sctx.strokeStyle = isMajor ? palette.accent : palette.ink;
    sctx.globalAlpha = isMajor ? 0.35 : 0.15;

    for (let x = 0; x <= w; x += 16) {
      const wave1 = Math.sin(x * 0.012 + drift + i * 0.4) * 22;
      const wave2 = Math.cos(x * 0.024 - drift * 0.8) * 10;
      const y = baseY + wave1 + wave2;

      if (x === 0) sctx.moveTo(x, y);
      else sctx.lineTo(x, y);
    }
    sctx.stroke();

    // Elevation Meter Label on major lines
    if (isMajor) {
      sctx.fillStyle = palette.accent;
      sctx.font = '600 7px "Space Mono", monospace';
      sctx.globalAlpha = 0.4;
      sctx.fillText(`+${i * 120}m`, 16, baseY - 6);
    }
  }

  sctx.restore();
}
