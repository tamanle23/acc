import type { ShaderStrategy } from '@/types/shader';

const ASCII_RAMP = [' ', '.', ':', '-', '=', '+', '*', '%', '#', '@'];

/**
 * ASCII Matrix Terminal Shader Strategy
 * Monospace density character field mapped to kinetic harmonic vector waves.
 * Evokes vintage mainframe terminals and cybernetic telemetry monitors.
 */
export const renderAsciiMatrixTerminal: ShaderStrategy = ({
  sctx,
  w,
  h,
  theta,
  energy,
  pulse,
  palette,
}) => {
  sctx.save();

  const cols = 22;
  const rows = 32;
  const cellW = w / cols;
  const cellH = h / rows;
  const fontSize = Math.max(7, Math.round(cellH * 0.75));

  sctx.font = `700 ${fontSize}px "Space Mono", monospace`;
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cellW;
      const cy = (r + 0.5) * cellH;

      // 2D Wave height field
      const distFromCenter = Math.hypot((c - cols / 2) / (cols / 2), (r - rows / 2) / (rows / 2));
      const wave1 = Math.sin(c * 0.35 + theta * 2 * energy);
      const wave2 = Math.cos(r * 0.28 - theta * 1.5);
      const wave3 = Math.sin(distFromCenter * 4 - theta * 3 * pulse);

      const density = 0.5 + 0.5 * (wave1 * 0.4 + wave2 * 0.35 + wave3 * 0.25);
      const charIndex = Math.min(ASCII_RAMP.length - 1, Math.max(0, Math.floor(density * ASCII_RAMP.length)));
      const glyph = ASCII_RAMP[charIndex]!;

      if (glyph !== ' ') {
        const isHighlight = charIndex >= ASCII_RAMP.length - 3;
        sctx.fillStyle = isHighlight ? palette.accent : palette.ink;
        sctx.globalAlpha = isHighlight ? 0.75 : 0.2 + density * 0.35;
        sctx.fillText(glyph, cx, cy);
      }
    }
  }

  // Scanning CRT Beam Bar
  const scanY = ((theta / (Math.PI * 2)) * h * 1.5) % h;
  sctx.fillStyle = palette.accent;
  sctx.globalAlpha = 0.12 * pulse;
  sctx.fillRect(0, scanY, w, 4);

  sctx.restore();
};
