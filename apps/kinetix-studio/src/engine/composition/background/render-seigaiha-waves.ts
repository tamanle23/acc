import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

/**
 * 10. Seigaiha Waves
 * Traditional Japanese geometric overlapping fan wave arches.
 */
export function renderSeigaihaWaves({
  sctx,
  w,
  h,
  palette,
  scaleFactor,
}: BackgroundGeneratorOptions): void {
  const arcRadius = 32 * scaleFactor;
  const stepX = arcRadius * 2;
  const stepY = arcRadius * 0.7;

  sctx.save();
  sctx.lineWidth = 1.1;

  const cols = Math.ceil(w / stepX) + 2;
  const rows = Math.ceil(h / stepY) + 2;

  for (let r = 0; r < rows; r++) {
    const offsetY = r * stepY;
    const isOdd = r % 2 === 1;

    for (let c = 0; c < cols; c++) {
      const offsetX = c * stepX + (isOdd ? arcRadius : 0);

      // 4 Concentric Arches per fan
      for (let ring = 1; ring <= 4; ring++) {
        const rad = (arcRadius / 4) * ring;
        sctx.beginPath();
        sctx.strokeStyle = ring % 2 === 0 ? palette.accent : palette.ink;
        sctx.globalAlpha = 0.08 + ring * 0.04;
        sctx.arc(offsetX, offsetY, rad, Math.PI, 0);
        sctx.stroke();
      }
    }
  }

  sctx.restore();
}
