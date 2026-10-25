import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';
import { roundRect } from './utils';

export class IsometricBillboardRenderer implements IDepth3DRenderer {
  readonly mode = 'isometric_billboard';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, width, height, timeSec } = state;
    ctx.save();
    ctx.fillStyle = '#080914';
    ctx.fillRect(0, 0, width, height);

    // 30-degree Isometric Skew Matrix Transformation
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6); // -30 deg
    ctx.transform(1, Math.tan(Math.PI / 6), 0, 1, 0, 0); // skewX 30 deg
    ctx.translate(-width / 2, -height / 2);

    const cardW = width * 0.55;
    const cardH = height * 0.55;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2 + Math.sin(timeSec * Math.PI * 0.8) * 10;

    // Isometric 3D Slab Thickness
    ctx.fillStyle = '#1b1d36';
    roundRect(ctx, cardX + 18, cardY + 18, cardW, cardH, 16);
    ctx.fill();

    // Front Billboard Face
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fill();

    ctx.save();
    roundRect(ctx, cardX + 8, cardY + 8, cardW - 16, cardH - 16, 12);
    ctx.clip();
    drawImageCover(ctx, img, cardX + 8, cardY + 8, cardW - 16, cardH - 16);
    ctx.restore();

    ctx.restore();
    ctx.restore();
  }
}
