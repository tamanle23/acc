import type { ShaderStrategy } from '@/types/shader';

export const renderHarmonograph: ShaderStrategy = ({ sctx, w, h, theta, energy, pulse, palette }) => {
  const cx = w * 0.5;
  const cy = h * 0.38;
  const rx = w * 0.34 * pulse;
  const ry = h * 0.25 * pulse;
  sctx.beginPath();
  sctx.strokeStyle = palette.accent;
  sctx.lineWidth = 1.4;
  sctx.globalAlpha = 0.55;
  const steps = 260;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 8;
    const damp = 1 - (i / steps) * 0.55;
    const x = cx + Math.sin(3 * t + theta * energy) * rx * damp;
    const y = cy + Math.sin(4 * t + theta * 2) * ry * damp;
    if (i === 0) sctx.moveTo(x, y);
    else sctx.lineTo(x, y);
  }
  sctx.stroke();
  sctx.globalAlpha = 1;
};

