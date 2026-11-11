import type { ShaderStrategy } from '@/types/shader';

/**
 * Hyper Lattice Shader: Isometric multi-dimensional crystalline wireframe grid
 * with depth-projected nodes, shimmering vertices, and volumetric coordinate lines.
 */
export const renderHyperLattice: ShaderStrategy = ({
  sctx,
  w,
  h,
  theta,
  energy,
  pulse,
  palette,
}) => {
  const cx = w * 0.5;
  const cy = h * 0.46;
  const gridSize = 5;
  const spacing = 38 * pulse;

  sctx.save();
  sctx.translate(cx, cy);

  // Isometric projection matrix angles
  const cosIso = Math.cos(Math.PI / 6);
  const sinIso = Math.sin(Math.PI / 6);

  // 1. Projected 3D Grid Plane
  sctx.lineWidth = 1.2;
  for (let ix = -gridSize; ix <= gridSize; ix++) {
    for (let iy = -gridSize; iy <= gridSize; iy++) {
      // 3D coordinate with dynamic wave height
      const distFromCenter = Math.sqrt(ix * ix + iy * iy);
      const waveZ = Math.sin(distFromCenter * 0.9 - theta * 2) * 18 * energy;

      // Project (x, y, z) into 2D isometric space
      const px = (ix - iy) * cosIso * spacing;
      const py = (ix + iy) * sinIso * spacing - waveZ;

      // Draw connection to neighbor (+x)
      if (ix < gridSize) {
        const nextDist = Math.sqrt((ix + 1) * (ix + 1) + iy * iy);
        const nextZ = Math.sin(nextDist * 0.9 - theta * 2) * 18 * energy;
        const nx = (ix + 1 - iy) * cosIso * spacing;
        const ny = (ix + 1 + iy) * sinIso * spacing - nextZ;

        sctx.strokeStyle = palette.ink;
        sctx.globalAlpha = Math.max(0.04, (1 - distFromCenter / (gridSize * 1.4)) * 0.45);
        sctx.beginPath();
        sctx.moveTo(px, py);
        sctx.lineTo(nx, ny);
        sctx.stroke();
      }

      // Draw connection to neighbor (+y)
      if (iy < gridSize) {
        const nextDist = Math.sqrt(ix * ix + (iy + 1) * (iy + 1));
        const nextZ = Math.sin(nextDist * 0.9 - theta * 2) * 18 * energy;
        const nx = (ix - (iy + 1)) * cosIso * spacing;
        const ny = (ix + (iy + 1)) * sinIso * spacing - nextZ;

        sctx.strokeStyle = palette.accent2;
        sctx.globalAlpha = Math.max(0.04, (1 - distFromCenter / (gridSize * 1.4)) * 0.4);
        sctx.beginPath();
        sctx.moveTo(px, py);
        sctx.lineTo(nx, ny);
        sctx.stroke();
      }

      // Shimmering Node Vertices
      if ((ix + iy) % 2 === 0) {
        const nodeGlow = 0.35 + 0.5 * Math.sin(theta * 3 + distFromCenter);
        sctx.fillStyle = distFromCenter < 2 ? palette.accent : palette.ink;
        sctx.globalAlpha = Math.max(0.08, nodeGlow * energy);
        sctx.beginPath();
        sctx.arc(px, py, 2.4, 0, Math.PI * 2);
        sctx.fill();
      }
    }
  }

  sctx.restore();
};

