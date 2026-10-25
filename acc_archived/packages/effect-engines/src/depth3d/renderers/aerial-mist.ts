import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';

export class AerialMistRenderer implements IDepth3DRenderer {
  readonly mode = 'aerial_mist';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, progress } = state;
    ctx.save();
    // Distant Background Plate (Desaturated & Blue-tinted by Mist)
    drawImageCover(ctx, img, 0, 0, width, height, 1.05);

    // Aerial Mist Overlay
    ctx.fillStyle = 'rgba(180, 210, 240, 0.35)';
    ctx.fillRect(0, 0, width, height);

    // Foreground Subject Cuts Through Mist
    if (subjectImg) {
      ctx.save();
      const subScale = 1.0 + progress * 0.06;
      const subW = width * subScale;
      const subH = height * subScale;
      const subX = (width - subW) / 2;
      const subY = (height - subH) / 2;
      drawImageCover(ctx, subjectImg, subX, subY, subW, subH);
      ctx.restore();
    }

    ctx.restore();
  }
}
