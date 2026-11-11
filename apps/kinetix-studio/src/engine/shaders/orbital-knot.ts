import type { ShaderStrategy } from '@/types/shader';

export const renderOrbitalKnot: ShaderStrategy = ({ sctx, w, h, theta, energy, pulse, palette }) => {
  const cx = w * 0.5;
  const cy = h * 0.38;
  const baseR = Math.min(w, h) * 0.28 * pulse;
  for (let ring = 0; ring < 3; ring++) {
    sctx.beginPath();
    sctx.strokeStyle = ring === 0 ? palette.accent : ring === 1 ? palette.accent2 : palette.ink;
    sctx.lineWidth = ring === 0 ? 2.2 : 1.1;
    sctx.globalAlpha = ring === 0 ? 0.65 : 0.3;
    const steps = 110;
    for (let i = 0; i <= steps; i++) {
      const u = (i / steps) * Math.PI * 2;
      const r = baseR * (0.75 + 0.28 * Math.cos(3 * u + theta * (ring + 1) * energy));
      const x = cx + r * Math.cos(2 * u + theta * 0.5);
      const y = cy + r * Math.sin(3 * u + theta) * 0.85;
      if (i === 0) sctx.moveTo(x, y);
      else sctx.lineTo(x, y);
    }
    sctx.closePath();
    sctx.stroke();
  }
  sctx.globalAlpha = 1;
};

