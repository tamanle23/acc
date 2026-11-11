import type { ShaderStrategy } from '@/types/shader';

export const renderSonarRadar: ShaderStrategy = ({ sctx, w, h, theta, pulse, palette }) => {
  const cx = w * 0.5;
  const cy = h * 0.38;
  const maxR = Math.min(w, h) * 0.36 * pulse;
  sctx.strokeStyle = palette.accent;
  for (let r = 1; r <= 4; r++) {
    sctx.globalAlpha = 0.22;
    sctx.beginPath();
    sctx.arc(cx, cy, (maxR * r) / 4, 0, Math.PI * 2);
    sctx.stroke();
  }
  sctx.globalAlpha = 0.75;
  sctx.lineWidth = 2;
  sctx.beginPath();
  sctx.moveTo(cx, cy);
  sctx.lineTo(cx + Math.cos(theta) * maxR, cy + Math.sin(theta) * maxR);
  sctx.stroke();
  sctx.globalAlpha = 1;
};

