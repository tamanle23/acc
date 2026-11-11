import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

/**
 * 7. Hexagonal Cyber Matrix
 * Honeycomb tessellation grid with illuminated vertex nodes.
 */
export function renderHexMesh({
  sctx,
  w,
  h,
  palette,
  theta,
  motion,
}: BackgroundGeneratorOptions): void {
  const drift = motion ? theta * 0.15 : 0;
  const hexRadius = 26;
  const hexW = Math.sqrt(3) * hexRadius;
  const hexH = 2 * hexRadius * 0.75;

  sctx.save();
  sctx.strokeStyle = palette.accent;
  sctx.lineWidth = 0.8;

  const cols = Math.ceil(w / hexW) + 2;
  const rows = Math.ceil(h / hexH) + 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = (r % 2) * (hexW / 2);
      const cx = c * hexW + offsetX;
      const cy = r * hexH;

      const shimmer = Math.sin(c * 0.5 + r * 0.4 + drift);
      sctx.globalAlpha = 0.08 + Math.max(0, shimmer * 0.28);

      sctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 6;
        const x = cx + hexRadius * Math.cos(angle);
        const y = cy + hexRadius * Math.sin(angle);
        if (i === 0) sctx.moveTo(x, y);
        else sctx.lineTo(x, y);
      }
      sctx.closePath();
      sctx.stroke();

      // Glowing vertex node
      if (shimmer > 0.6) {
        sctx.fillStyle = palette.accent2;
        sctx.globalAlpha = 0.5;
        sctx.beginPath();
        sctx.arc(cx, cy, 2, 0, Math.PI * 2);
        sctx.fill();
      }
    }
  }

  sctx.restore();
}
