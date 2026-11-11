import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

/**
 * 5. Bauhaus Geometric Shapes
 * Modernist constructivist diagonal bars, circular wedges, and primary arches.
 */
export function renderBauhausGeo({
  sctx,
  w,
  h,
  palette,
  theta,
  motion,
}: BackgroundGeneratorOptions): void {
  const drift = motion ? theta * 0.15 : 0;
  sctx.save();

  // 1. Massive Primary Circle Arc Wedge
  const arcR = Math.min(w, h) * 0.42;
  const arcX = w * (0.8 + 0.05 * Math.sin(drift));
  const arcY = h * (0.25 + 0.05 * Math.cos(drift));
  sctx.fillStyle = palette.accent;
  sctx.globalAlpha = 0.18;
  sctx.beginPath();
  sctx.moveTo(arcX, arcY);
  sctx.arc(arcX, arcY, arcR, Math.PI * 0.5, Math.PI * 1.5);
  sctx.closePath();
  sctx.fill();

  // 2. Bold Constructivist Diagonal Stripes Block
  sctx.strokeStyle = palette.ink;
  sctx.lineWidth = 12;
  sctx.globalAlpha = 0.1;
  const startX = -w * 0.2;
  for (let offset = 0; offset < w * 1.2; offset += 36) {
    sctx.beginPath();
    sctx.moveTo(startX + offset, h);
    sctx.lineTo(startX + offset + w * 0.6, 0);
    sctx.stroke();
  }

  // 3. Balanced Secondary Arch
  const bR = Math.min(w, h) * 0.28;
  const bX = w * 0.2;
  const bY = h * 0.78;
  sctx.fillStyle = palette.accent2;
  sctx.globalAlpha = 0.16;
  sctx.beginPath();
  sctx.arc(bX, bY, bR, 0, Math.PI, true);
  sctx.fill();

  sctx.restore();
}
