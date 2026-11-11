import type { ShaderStrategy } from '@/types/shader';

export const renderPlexusNet: ShaderStrategy = ({ sctx, w, h, theta, energy, palette }) => {
  const nodes: Array<[number, number]> = [];
  const count = 24;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const nx = w * 0.5 + Math.cos(a + theta * energy) * (w * 0.34) * Math.sin(i * 1.7 + theta);
    const ny = h * 0.4 + Math.sin(a * 2 + theta) * (h * 0.26);
    nodes.push([nx, ny]);
  }
  sctx.strokeStyle = palette.accent;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = nodes[i][0] - nodes[j][0];
      const dy = nodes[i][1] - nodes[j][1];
      const dist = Math.hypot(dx, dy);
      if (dist < 120) {
        sctx.globalAlpha = (1 - dist / 120) * 0.45;
        sctx.beginPath();
        sctx.moveTo(nodes[i][0], nodes[i][1]);
        sctx.lineTo(nodes[j][0], nodes[j][1]);
        sctx.stroke();
      }
    }
    sctx.fillStyle = palette.ink;
    sctx.globalAlpha = 0.7;
    sctx.beginPath();
    sctx.arc(nodes[i][0], nodes[i][1], 2.5, 0, Math.PI * 2);
    sctx.fill();
  }
  sctx.globalAlpha = 1;
};

