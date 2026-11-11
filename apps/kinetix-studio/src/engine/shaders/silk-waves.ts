import type { ShaderStrategy } from '@/types/shader';

export const renderSilkWaves: ShaderStrategy = ({ sctx, w, h, theta, energy, palette }) => {
  const lines = 22;
  for (let i = 0; i < lines; i++) {
    const frac = i / lines;
    sctx.beginPath();
    sctx.strokeStyle = i % 3 === 0 ? palette.accent : palette.accent2;
    sctx.globalAlpha = 0.14 + (1 - Math.abs(frac - 0.5) * 2) * 0.45;
    sctx.lineWidth = i % 4 === 0 ? 1.8 : 0.9;
    for (let x = 0; x <= w; x += 12) {
      const nx = x / w;
      const wave =
        Math.sin(nx * Math.PI * 3 + theta + i * 0.32) * 34 * energy +
        Math.cos(nx * Math.PI * 2 - theta * 2 + i * 0.2) * 18 * energy;
      const y = h * (0.15 + frac * 0.7) + wave;
      if (x === 0) sctx.moveTo(x, y);
      else sctx.lineTo(x, y);
    }
    sctx.stroke();
  }
  sctx.globalAlpha = 1;
};

