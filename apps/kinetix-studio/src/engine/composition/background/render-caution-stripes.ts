import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

/**
 * 11. Caution Stripes
 * Brutalist high-contrast hazard diagonal warning stripes.
 */
export function renderCautionStripes({
  sctx,
  w,
  h,
  palette,
  theta,
  motion,
}: BackgroundGeneratorOptions): void {
  const drift = motion ? (theta * 15) % 40 : 0;
  const stripeW = 16;
  const gap = 24;
  const period = stripeW + gap;

  sctx.save();
  sctx.fillStyle = palette.accent;
  sctx.globalAlpha = 0.14;

  const totalW = w + h;
  for (let x = -h + drift; x < totalW; x += period) {
    sctx.beginPath();
    sctx.moveTo(x, 0);
    sctx.lineTo(x + stripeW, 0);
    sctx.lineTo(x + stripeW - h, h);
    sctx.lineTo(x - h, h);
    sctx.closePath();
    sctx.fill();
  }

  sctx.restore();
}
