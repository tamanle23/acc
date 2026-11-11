import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

/**
 * 4. Blueprint Coordinate Grid
 * Architectural drafting millimeter coordinate grid with crosshairs and sub-divisions.
 */
export function renderBlueprintGrid({
  sctx,
  w,
  h,
  palette,
  scaleFactor,
}: BackgroundGeneratorOptions): void {
  sctx.save();

  const majorStep = Math.max(28, Math.round(36 * scaleFactor));
  const minorStep = majorStep / 4;

  // Minor sub-division grid
  sctx.strokeStyle = palette.accent;
  sctx.lineWidth = 0.5;
  sctx.globalAlpha = 0.08;
  sctx.beginPath();
  for (let x = 0; x <= w; x += minorStep) {
    sctx.moveTo(x, 0);
    sctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += minorStep) {
    sctx.moveTo(0, y);
    sctx.lineTo(w, y);
  }
  sctx.stroke();

  // Major millimeter grid
  sctx.strokeStyle = palette.accent;
  sctx.lineWidth = 0.8;
  sctx.globalAlpha = 0.22;
  sctx.beginPath();
  for (let x = 0; x <= w; x += majorStep) {
    sctx.moveTo(x, 0);
    sctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += majorStep) {
    sctx.moveTo(0, y);
    sctx.lineTo(w, y);
  }
  sctx.stroke();

  // Corner Intersection Crosshairs (+)
  sctx.lineWidth = 1.2;
  sctx.globalAlpha = 0.45;
  const crossSize = 4 * scaleFactor;
  for (let x = majorStep; x < w; x += majorStep * 2) {
    for (let y = majorStep; y < h; y += majorStep * 2) {
      sctx.beginPath();
      sctx.moveTo(x - crossSize, y);
      sctx.lineTo(x + crossSize, y);
      sctx.moveTo(x, y - crossSize);
      sctx.lineTo(x, y + crossSize);
      sctx.stroke();
    }
  }

  sctx.restore();
}
