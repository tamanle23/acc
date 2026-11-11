import type { ShaderStrategy } from '@/types/shader';

/**
 * Reaction-Diffusion (Turing Morphogenesis) Shader Strategy
 * Pure analytical simulation of Gray-Scott morphogenesis patterns yielding
 * generative labyrinthine stripes, organic spots, and cellular tissue boundaries.
 */
export const renderReactionDiffusion: ShaderStrategy = ({
  sctx,
  w,
  h,
  theta,
  energy,
  pulse,
  palette,
}) => {
  sctx.save();
  const rows = 14;
  const cols = 10;
  const dx = w / cols;
  const dy = h / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = (c + 0.5) * dx;
      const py = (r + 0.5) * dy;

      // Coupled Reaction-Diffusion activator/inhibitor wave equation
      const nx = c * 0.45;
      const ny = r * 0.45;
      const morph1 = Math.sin(nx * 1.4 + theta * 1.2 * energy) * Math.cos(ny * 1.4 - theta * 0.8);
      const morph2 = Math.sin(ny * 2.2 + theta * 0.5) * Math.cos(nx * 2.2 + theta);
      const morph = (morph1 + morph2) * 0.5;

      const cellVal = 0.5 + 0.5 * morph;
      const radius = Math.max(1, (dx * 0.38) * cellVal * pulse);

      sctx.beginPath();
      if (cellVal > 0.58) {
        // Activator Coral Ribbon / Filament
        sctx.strokeStyle = palette.accent;
        sctx.lineWidth = 1.8 * pulse;
        sctx.globalAlpha = 0.55 * (0.4 + 0.6 * cellVal);
        const angle = morph * Math.PI * 2;
        sctx.moveTo(px - Math.cos(angle) * radius, py - Math.sin(angle) * radius);
        sctx.lineTo(px + Math.cos(angle) * radius, py + Math.sin(angle) * radius);
        sctx.stroke();
      } else {
        // Inhibitor Spot Node
        sctx.fillStyle = palette.accent2;
        sctx.globalAlpha = 0.35 * (1 - cellVal);
        sctx.arc(px, py, radius * 0.6, 0, Math.PI * 2);
        sctx.fill();
      }
    }
  }

  // Interconnected Morphogen Tension Fringes
  sctx.beginPath();
  sctx.strokeStyle = palette.ink;
  sctx.lineWidth = 0.6;
  sctx.globalAlpha = 0.18;
  for (let r = 0; r < rows - 1; r += 2) {
    const y = (r + 1) * dy + Math.sin(theta + r) * 8 * energy;
    sctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 24) {
      const ripple = Math.cos(x * 0.05 + theta * 2) * 6 * energy;
      sctx.lineTo(x, y + ripple);
    }
  }
  sctx.stroke();

  sctx.restore();
};
