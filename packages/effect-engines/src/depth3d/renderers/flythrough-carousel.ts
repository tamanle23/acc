import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';
import { roundRect } from './utils';

export class FlythroughCarouselRenderer implements IDepth3DRenderer {
  readonly mode = 'flythrough_carousel';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, width, height, timeSec, progress } = state;
    ctx.save();
    ctx.fillStyle = '#04040a';
    ctx.fillRect(0, 0, width, height);

    const cardCount = 5;
    for (let i = cardCount - 1; i >= 0; i--) {
      // Z-depth progression along fly-through timeline
      const zProgress = (progress * 1.5 + i / cardCount) % 1.0;
      const zScale = Math.pow(zProgress, 2.2) * 1.4 + 0.1;
      const alpha = Math.min(1.0, zProgress * 2.5) * (1.0 - Math.pow(zProgress, 4));

      if (alpha <= 0.02) continue;

      const cardW = width * 0.5 * zScale;
      const cardH = height * 0.5 * zScale;
      const offsetX = Math.sin((i * 1.8) + timeSec) * width * 0.25 * zScale;
      const cardX = (width - cardW) / 2 + offsetX;
      const cardY = (height - cardH) / 2;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 20 * zScale;

      ctx.fillStyle = '#ffffff';
      roundRect(ctx, cardX, cardY, cardW, cardH, 12 * zScale);
      ctx.fill();

      ctx.save();
      roundRect(ctx, cardX + 6 * zScale, cardY + 6 * zScale, cardW - 12 * zScale, cardH - 12 * zScale, 8 * zScale);
      ctx.clip();
      drawImageCover(ctx, img, cardX, cardY, cardW, cardH);
      ctx.restore();

      ctx.restore();
    }

    ctx.restore();
  }
}
