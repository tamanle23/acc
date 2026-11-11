import type { ShaderStrategy } from '@/types/shader';

/**
 * Elementary Cellular Automata (Wolfram Rule 30 / 110) Shader Strategy
 * Deterministic mathematical evolution grid generating emergent complexity,
 * triangular pyramids, and cybernetic digital tapestry cascades.
 */
export const renderCellularAutomata: ShaderStrategy = ({
  sctx,
  w,
  h,
  theta,
  energy,
  pulse,
  palette,
}) => {
  sctx.save();

  const cols = 28;
  const rows = 24;
  const cellW = w / cols;
  const cellH = h / rows;

  // Rule 30 bitmask: 00011110 = 30
  // Next state depends on left, center, right bits
  const evaluateRule30 = (left: number, center: number, right: number): number => {
    const pattern = (left << 2) | (center << 1) | right;
    return (30 & (1 << pattern)) !== 0 ? 1 : 0;
  };

  // Seed first row dynamically with rotating seed bit
  const seedShift = Math.floor((theta / (Math.PI * 2)) * cols) % cols;
  let currentRow: number[] = new Array(cols).fill(0);
  currentRow[Math.floor(cols / 2)] = 1;
  currentRow[(Math.floor(cols / 2) + seedShift) % cols] = 1;

  for (let r = 0; r < rows; r++) {
    const py = r * cellH;

    for (let c = 0; c < cols; c++) {
      if (currentRow[c] === 1) {
        const px = c * cellW;
        const cellPhase = (r * cols + c) * 0.1;
        const shimmer = 0.5 + 0.5 * Math.sin(theta * 2 * energy + cellPhase);

        sctx.fillStyle = c % 2 === 0 ? palette.accent : palette.accent2;
        sctx.globalAlpha = (0.25 + 0.5 * shimmer) * pulse;

        const pad = Math.max(0.5, 1.5 * (1 - energy * 0.4));
        sctx.fillRect(px + pad, py + pad, cellW - pad * 2, cellH - pad * 2);
      }
    }

    // Compute next row state
    const nextRow = new Array(cols).fill(0);
    for (let c = 0; c < cols; c++) {
      const left = c > 0 ? currentRow[c - 1]! : currentRow[cols - 1]!;
      const center = currentRow[c]!;
      const right = c < cols - 1 ? currentRow[c + 1]! : currentRow[0]!;
      nextRow[c] = evaluateRule30(left, center, right);
    }
    currentRow = nextRow;
  }

  // Vertical Guide Division Wireframes
  sctx.strokeStyle = palette.ink;
  sctx.lineWidth = 0.5;
  sctx.globalAlpha = 0.12;
  sctx.beginPath();
  for (let c = 0; c <= cols; c += 4) {
    sctx.moveTo(c * cellW, 0);
    sctx.lineTo(c * cellW, h);
  }
  sctx.stroke();

  sctx.restore();
};
