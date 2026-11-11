import type { ShaderStrategy } from '@/types/shader';

export const renderCyberMatrix: ShaderStrategy = ({ sctx, w, h, theta, energy, palette }) => {
  const cols = 16;
  const colW = w / cols;
  for (let c = 0; c < cols; c++) {
    const speed = 1 + (c % 3);
    const headY = ((theta / (Math.PI * 2)) * speed * energy + c * 0.17) % 1;
    for (let r = 0; r < 18; r++) {
      const ry = r / 18;
      const dist = (headY - ry + 1) % 1;
      if (dist < 0.35) {
        sctx.fillStyle = dist < 0.06 ? palette.ink : palette.accent;
        sctx.globalAlpha = (1 - dist / 0.35) * 0.55;
        sctx.fillRect(c * colW + 4, ry * h, colW - 8, 6);
      }
    }
  }
  sctx.globalAlpha = 1;
};

