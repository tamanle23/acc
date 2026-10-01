import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';
import { roundRect } from './utils';

export class DiffuseShadowRenderer implements IDepth3DRenderer {
  readonly mode = 'diffuse_shadow';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    ctx.fillStyle = '#0b0c16';
    ctx.fillRect(0, 0, width, height);

    const floatY = Math.sin(timeSec * Math.PI * 1.0) * 12;
    const cardW = width * 0.72;
    const cardH = height * 0.72;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2 + floatY;

    // Multi-tier Elevation Shadows (Tier 1: Ambient soft blur, Tier 2: Directional crisp shadow)
    ctx.save();
    // Shadow Tier 1
    ctx.shadowColor = 'rgba(0, 5, 25, 0.45)';
    ctx.shadowBlur = 45;
    ctx.shadowOffsetY = 30;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fill();

    // Shadow Tier 2
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fill();
    ctx.restore();

    // Card Content
    ctx.save();
    roundRect(ctx, cardX + 10, cardY + 10, cardW - 20, cardH - 20, 18);
    ctx.clip();
    drawImageCover(ctx, img, cardX + 10, cardY + 10, cardW - 20, cardH - 20);
    if (subjectImg) {
      drawImageCover(ctx, subjectImg, cardX + 10, cardY + 10, cardW - 20, cardH - 20);
    }
    ctx.restore();

    ctx.restore();
  }
}
