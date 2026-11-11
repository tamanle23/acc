import type { ShaderStrategy } from '@/types/shader';

export const renderGoldenVortex: ShaderStrategy = ({ sctx, w, h, theta, energy, pulse, palette }) => {
  const cx = w * 0.5;
  const cy = h * 0.38;
  const maxR = Math.min(w, h) * 0.38;
  const count = 110;
  const goldenAngle = 2.399963229728653;
  for (let i = 1; i <= count; i++) {
    const frac = i / count;
    const angle = i * goldenAngle + theta * (1 + frac * 0.5 * energy);
    const r = Math.sqrt(frac) * maxR * pulse;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const dotR = (1.5 + frac * 4.5) * (1 + 0.3 * Math.sin(theta * 2 - frac * 6));
    sctx.beginPath();
    sctx.fillStyle = i % 3 === 0 ? palette.accent : i % 3 === 1 ? palette.accent2 : palette.ink;
    sctx.globalAlpha = 0.25 + (1 - frac) * 0.65;
    sctx.arc(x, y, dotR, 0, Math.PI * 2);
    sctx.fill();
  }
  sctx.globalAlpha = 1;
};

