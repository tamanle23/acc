import type { ShaderStrategy } from '@/types/shader';

/**
 * Chladni Plate Shader: Simulates acoustic nodal resonance on a vibrating plate.
 * Governed by Ernst Chladni's 2D modal equation:
 * a * sin(n*pi*x/L) * sin(m*pi*y/L) - b * sin(m*pi*x/L) * sin(n*pi*y/L) = 0
 */
export const renderChladniPlate: ShaderStrategy = ({
  sctx,
  w,
  h,
  theta,
  energy,
  pulse,
  palette,
}) => {
  const cx = w * 0.5;
  const cy = h * 0.45;
  const plateSize = Math.min(w, h) * 0.72;

  sctx.save();
  sctx.translate(cx, cy);

  // 1. Resonant Square Plate Perimeter
  sctx.strokeStyle = palette.ink;
  sctx.globalAlpha = 0.25;
  sctx.lineWidth = 1.5;
  sctx.strokeRect(-plateSize * 0.5, -plateSize * 0.5, plateSize, plateSize);

  // Modal parameters dynamic with theta
  const m = 3 + Math.floor(Math.abs(Math.sin(theta * 0.5)) * 2);
  const n = 5;
  const a = Math.cos(theta);
  const b = Math.sin(theta);

  // 2. Chladni Sand Grain Nodal Lines
  const samples = 180;
  sctx.fillStyle = palette.accent;
  for (let i = 0; i < samples; i++) {
    const u = ((i * 1.618) % 1) * 2 - 1; // -1 to 1
    const v = (((i * 2.718) % 1) * 2 - 1) * 0.95;

    // Evaluate Chladni nodal value
    const chladniVal =
      a * Math.sin(n * Math.PI * u) * Math.sin(m * Math.PI * v) -
      b * Math.sin(m * Math.PI * u) * Math.sin(n * Math.PI * v);

    // Sand grains gather where chladniVal is close to 0 (nodal lines)
    const proximity = Math.abs(chladniVal);
    if (proximity < 0.42) {
      const grainX = u * plateSize * 0.48;
      const grainY = v * plateSize * 0.48;
      const grainAlpha = (1 - proximity / 0.42) * energy * 0.85;

      sctx.fillStyle = i % 2 === 0 ? palette.accent : palette.accent2;
      sctx.globalAlpha = Math.max(0.05, grainAlpha);
      sctx.beginPath();
      sctx.arc(grainX, grainY, (1.2 + (i % 3) * 0.6) * pulse, 0, Math.PI * 2);
      sctx.fill();
    }
  }

  // 3. Central Acoustic Exciter Core
  sctx.strokeStyle = palette.accent;
  sctx.lineWidth = 2;
  sctx.globalAlpha = 0.6 * pulse;
  sctx.beginPath();
  sctx.arc(0, 0, 14 * pulse, 0, Math.PI * 2);
  sctx.stroke();

  sctx.restore();
};

