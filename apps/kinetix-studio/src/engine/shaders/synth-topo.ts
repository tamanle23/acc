import type { ShaderStrategy } from '@/types/shader';

export const renderSynthTopo: ShaderStrategy = ({ sctx, w, h, theta, energy, palette }) => {
  const rings = 14;
  const cx = w * 0.5;
  const cy = h * 0.4;
  for (let r = 1; r <= rings; r++) {
    sctx.beginPath();
    sctx.strokeStyle = r % 2 === 0 ? palette.accent : palette.accent2;
    sctx.globalAlpha = 0.18 + (r / rings) * 0.35;
    sctx.lineWidth = 1.2;
    const baseRadius = r * (Math.min(w, h) * 0.032);
    for (let a = 0; a <= 64; a++) {
      const ang = (a / 64) * Math.PI * 2;
      const wobble =
        Math.sin(ang * 4 + theta * energy + r * 0.4) * 12 +
        Math.cos(ang * 3 - theta) * 8;
      const rad = Math.max(2, baseRadius + wobble);
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad * 0.75;
      if (a === 0) sctx.moveTo(x, y);
      else sctx.lineTo(x, y);
    }
    sctx.closePath();
    sctx.stroke();
  }
  sctx.globalAlpha = 1;
};

