import type { ShaderStrategy } from '@/types/shader';

/**
 * Voronoi Bio Shader: Bioluminescent cellular tissue tessellation with
 * pulsating nuclei, membrane boundaries, and cytoplasmic fluid currents.
 */
export const renderVoronoiBio: ShaderStrategy = ({
  sctx,
  w,
  h,
  theta,
  energy,
  palette,
}) => {
  const cellCount = 14;
  const cells: { x: number; y: number; r: number; color: string }[] = [];

  // Generate dynamic cell seeds
  for (let i = 0; i < cellCount; i++) {
    const seedX = ((i * 137.5) % w);
    const seedY = ((i * 89.3) % h);
    const driftX = Math.sin(theta + i * 0.9) * 28 * energy;
    const driftY = Math.cos(theta * 0.8 + i * 1.1) * 28 * energy;
    cells.push({
      x: seedX + driftX,
      y: seedY + driftY,
      r: 24 + ((i * 13) % 45),
      color: i % 2 === 0 ? palette.accent : palette.accent2,
    });
  }

  sctx.save();

  // 1. Cellular Membrane Boundaries (Connecting neighbor lines)
  sctx.lineWidth = 1.4;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const c1 = cells[i]!;
      const c2 = cells[j]!;
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 140) {
        const alpha = (1 - dist / 140) * 0.45 * energy;
        sctx.strokeStyle = palette.ink;
        sctx.globalAlpha = Math.max(0.04, alpha);
        sctx.beginPath();
        sctx.moveTo(c1.x, c1.y);
        sctx.lineTo(c2.x, c2.y);
        sctx.stroke();

        // Membrane midpoint junction vesicle
        const mx = (c1.x + c2.x) * 0.5;
        const my = (c1.y + c2.y) * 0.5;
        sctx.fillStyle = palette.accent;
        sctx.globalAlpha = alpha * 0.8;
        sctx.beginPath();
        sctx.arc(mx, my, 2.2, 0, Math.PI * 2);
        sctx.fill();
      }
    }
  }

  // 2. Bioluminescent Cell Nuclei & Cytoplasm Halos
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    const glowRad = c.r * (1 + 0.25 * Math.sin(theta * 2 + i));

    // Cytoplasmic glow halo
    const grad = sctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, glowRad);
    grad.addColorStop(0, c.color + '55');
    grad.addColorStop(0.6, c.color + '15');
    grad.addColorStop(1, 'transparent');

    sctx.fillStyle = grad;
    sctx.globalAlpha = 0.6 * energy;
    sctx.beginPath();
    sctx.arc(c.x, c.y, glowRad, 0, Math.PI * 2);
    sctx.fill();

    // Dense glowing nucleus
    sctx.fillStyle = palette.ink;
    sctx.globalAlpha = 0.75;
    sctx.beginPath();
    sctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
    sctx.fill();
  }

  sctx.restore();
};

