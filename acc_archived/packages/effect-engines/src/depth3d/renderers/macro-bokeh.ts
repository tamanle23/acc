import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';

export class MacroBokehRenderer implements IDepth3DRenderer {
  readonly mode = 'macro_bokeh';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, frame } = state;
    ctx.save();
    // Crisp Subject & Background
    drawImageCover(ctx, img, 0, 0, width, height);
    if (subjectImg) drawImageCover(ctx, subjectImg, 0, 0, width, height);

    // Foreground Heavily Blurred Macro Light Orbs / Bokeh
    ctx.save();
    const orbCount = 12;
    for (let i = 0; i < orbCount; i++) {
      const bx = (Math.sin(i * 37 + frame * 0.02) * 0.5 + 0.5) * width;
      const by = (Math.cos(i * 73 + frame * 0.015) * 0.5 + 0.5) * height;
      const size = 45 + (i % 5) * 25;
      const opacity = 0.25 + (i % 4) * 0.12;

      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, size);
      grad.addColorStop(0, `rgba(255, 235, 180, ${opacity * 1.5})`);
      grad.addColorStop(0.6, `rgba(255, 180, 120, ${opacity * 0.6})`);
      grad.addColorStop(1, 'rgba(255, 180, 120, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }
}
