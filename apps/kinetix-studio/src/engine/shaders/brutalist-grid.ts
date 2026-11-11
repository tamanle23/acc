import type { ShaderStrategy } from '@/types/shader';

export const renderBrutalistGrid: ShaderStrategy = ({ sctx, w, h, theta, energy, palette }) => {
  const horizon = h * 0.42;
  sctx.strokeStyle = palette.accent;
  sctx.globalAlpha = 0.28;
  sctx.lineWidth = 1;
  const cols = 12;
  for (let i = -cols; i <= cols; i++) {
    sctx.beginPath();
    sctx.moveTo(w * 0.5 + i * 14, horizon);
    sctx.lineTo(w * 0.5 + i * 95, h);
    sctx.stroke();
  }
  const rows = 10;
  const offset = (theta / (Math.PI * 2)) % 1;
  for (let r = 0; r < rows; r++) {
    const p = Math.pow((r + offset * energy) / rows, 1.8);
    const y = horizon + p * (h - horizon);
    sctx.beginPath();
    sctx.moveTo(0, y);
    sctx.lineTo(w, y);
    sctx.stroke();
  }
  sctx.globalAlpha = 1;
};

