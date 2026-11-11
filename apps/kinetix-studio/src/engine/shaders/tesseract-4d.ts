import type { ShaderStrategy } from '@/types/shader';

export const renderTesseract4D: ShaderStrategy = ({ sctx, w, h, theta, energy, pulse, palette }) => {
  const cx = w * 0.5;
  const cy = h * 0.38;
  const scale = Math.min(w, h) * 0.22 * pulse;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 16; i++) {
    const x = i & 1 ? 1 : -1;
    const y = i & 2 ? 1 : -1;
    const z = i & 4 ? 1 : -1;
    const w4 = i & 8 ? 1 : -1;
    const a = theta * energy;
    const xw = x * Math.cos(a) - w4 * Math.sin(a);
    const zw = z * Math.cos(a) - y * Math.sin(a);
    const proj = 1 / (2.6 - xw * 0.45);
    pts.push([cx + (x * 0.7 + xw * 0.4) * scale * proj, cy + (y * 0.7 + zw * 0.4) * scale * proj]);
  }
  sctx.strokeStyle = palette.accent;
  sctx.lineWidth = 1.2;
  sctx.globalAlpha = 0.48;
  for (let i = 0; i < 16; i++) {
    for (let bit = 0; bit < 4; bit++) {
      const j = i ^ (1 << bit);
      if (i < j) {
        sctx.beginPath();
        sctx.moveTo(pts[i][0], pts[i][1]);
        sctx.lineTo(pts[j][0], pts[j][1]);
        sctx.stroke();
      }
    }
  }
  sctx.globalAlpha = 1;
};

