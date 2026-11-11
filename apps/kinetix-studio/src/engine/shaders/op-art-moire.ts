import type { ShaderStrategy } from '@/types/shader';

export const renderOpArtMoire: ShaderStrategy = ({ sctx, w, h, theta, energy, palette }) => {
  const cx1 = w * 0.5 + Math.cos(theta) * 28 * energy;
  const cy1 = h * 0.38 + Math.sin(theta) * 22 * energy;
  const cx2 = w * 0.5 - Math.cos(theta) * 28 * energy;
  const cy2 = h * 0.38 - Math.sin(theta) * 22 * energy;
  sctx.lineWidth = 1.4;
  for (let r = 12; r < 220; r += 12) {
    sctx.strokeStyle = palette.accent;
    sctx.globalAlpha = 0.26;
    sctx.beginPath();
    sctx.arc(cx1, cy1, r, 0, Math.PI * 2);
    sctx.stroke();

    sctx.strokeStyle = palette.accent2;
    sctx.beginPath();
    sctx.arc(cx2, cy2, r, 0, Math.PI * 2);
    sctx.stroke();
  }
  sctx.globalAlpha = 1;
};

