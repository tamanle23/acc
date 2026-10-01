import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';
import { roundRect } from './utils';

export class GlassmorphicFresnelRenderer implements IDepth3DRenderer {
  readonly mode = 'glassmorphic_fresnel';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    // Deep Background Plate
    drawImageCover(ctx, img, 0, 0, width, height, 1.08);

    const glassW = width * 0.78;
    const glassH = height * 0.62;
    const glassX = (width - glassW) / 2;
    const glassY = (height - glassH) / 2 + Math.sin(timeSec * Math.PI * 0.8) * 8;

    // Frosted Glass Plate Base
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    roundRect(ctx, glassX, glassY, glassW, glassH, 28);
    ctx.fill();

    // Fresnel Edge Glow Stroke
    const fresnelGrad = ctx.createLinearGradient(glassX, glassY, glassX + glassW, glassY + glassH);
    fresnelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    fresnelGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.15)');
    fresnelGrad.addColorStop(0.8, 'rgba(0, 229, 255, 0.6)');
    fresnelGrad.addColorStop(1, 'rgba(255, 0, 128, 0.8)');

    ctx.strokeStyle = fresnelGrad;
    ctx.lineWidth = 3;
    roundRect(ctx, glassX, glassY, glassW, glassH, 28);
    ctx.stroke();
    ctx.restore();

    // Subject Popping Over Glass Surface
    if (subjectImg) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 12;
      drawImageCover(ctx, subjectImg, glassX + 20, glassY - 20, glassW - 40, glassH);
      ctx.restore();
    }

    ctx.restore();
  }
}
