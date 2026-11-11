import type { ShaderStrategy } from '@/types/shader';

export const renderLiquidPlasma: ShaderStrategy = ({ sctx, w, h, theta, energy, pulse, palette }) => {
  const cx = w * 0.5;
  const cy = h * 0.38;
  sctx.save();
  sctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) {
    const phase = theta + (i * Math.PI * 2) / 5;
    const ox = cx + Math.sin(phase) * (w * 0.2) * energy;
    const oy = cy + Math.cos(phase) * (h * 0.15) * energy;
    const rad = Math.min(w, h) * (0.18 + (i % 2) * 0.06) * pulse;
    const grad = sctx.createRadialGradient(ox, oy, rad * 0.05, ox, oy, rad);
    const col = i % 2 === 0 ? palette.accent : palette.accent2;
    grad.addColorStop(0, col);
    grad.addColorStop(0.55, col + '55');
    grad.addColorStop(1, 'transparent');
    sctx.fillStyle = grad;
    sctx.beginPath();
    sctx.arc(ox, oy, rad, 0, Math.PI * 2);
    sctx.fill();
  }
  sctx.restore();
};

