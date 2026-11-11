import type { ShaderStrategy } from '@/types/shader';

/**
 * Neon Caustics Shader Strategy
 * Simulates underwater Snell's window light refraction, volumetric caustic ray webs,
 * and chromatic dispersion across fluid surface waves.
 */
export const renderNeonCaustics: ShaderStrategy = ({
  sctx,
  w,
  h,
  theta,
  energy,
  pulse,
  palette,
}) => {
  sctx.save();

  const numRibbons = 12;
  const stepX = 20;

  for (let r = 0; r < numRibbons; r++) {
    const frac = r / numRibbons;
    const baseY = h * (0.15 + frac * 0.7);

    // Wave parameters
    const freq = 0.015 + frac * 0.005;
    const speed = (1 + frac * 0.3) * energy;
    const amp = (18 + frac * 12) * pulse;

    sctx.beginPath();
    sctx.strokeStyle = r % 2 === 0 ? palette.accent : palette.accent2;
    sctx.lineWidth = Math.max(0.8, (2.2 - frac * 1.2) * pulse);
    sctx.globalAlpha = 0.25 + 0.35 * Math.sin(theta + r);

    for (let x = 0; x <= w; x += stepX) {
      // Coupled sinusoidal refraction formula
      const wave1 = Math.sin(x * freq + theta * speed);
      const wave2 = Math.cos(x * freq * 1.8 - theta * 0.7);
      const y = baseY + (wave1 * 0.65 + wave2 * 0.35) * amp;

      if (x === 0) sctx.moveTo(x, y);
      else sctx.lineTo(x, y);
    }
    sctx.stroke();

    // Caustic Focal Caustic Knots (Interference Highlights)
    if (r % 3 === 0) {
      const knotX = (w * 0.5 + Math.sin(theta * 1.5 + r) * w * 0.35 + w) % w;
      const knotY = baseY + Math.cos(knotX * freq + theta * speed) * amp;
      sctx.beginPath();
      sctx.fillStyle = palette.accent;
      sctx.globalAlpha = 0.65 * pulse;
      sctx.arc(knotX, knotY, 3.5 * pulse, 0, Math.PI * 2);
      sctx.fill();
    }
  }

  sctx.restore();
};
