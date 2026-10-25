import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';
import { roundRect } from './utils';

export class GyroFocalTiltRenderer implements IDepth3DRenderer {
  readonly mode = 'gyro_focal_tilt';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, width, height);

    // Simulated Gyro Mouse / Coordinate Tilt Orbit
    const tiltX = Math.sin(timeSec * Math.PI * 0.9) * 0.12; // radians rotateY
    const tiltY = Math.cos(timeSec * Math.PI * 0.7) * 0.08; // radians rotateX

    const cardW = width * 0.75;
    const cardH = height * 0.75;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    // Skew transformation mapping 3D rotational projection onto 2D matrix
    ctx.transform(Math.cos(tiltX), Math.sin(tiltY), -Math.sin(tiltX) * 0.5, Math.cos(tiltY), 0, 0);
    ctx.translate(-width / 2, -height / 2);

    // Card Multi-tier Drop Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 20;

    // Card White Frame
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX, cardY, cardW, cardH, 20);
    ctx.fill();

    // Inner Image
    ctx.save();
    roundRect(ctx, cardX + 12, cardY + 12, cardW - 24, cardH - 24, 14);
    ctx.clip();
    drawImageCover(ctx, img, cardX + 12, cardY + 12, cardW - 24, cardH - 24);
    ctx.restore();

    // Parallax Subject Floating Ahead of Tilted Card Plane
    if (subjectImg) {
      const subX = cardX + tiltX * 80;
      const subY = cardY + tiltY * 60;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 20;
      drawImageCover(ctx, subjectImg, subX, subY, cardW, cardH);
    }

    ctx.restore();
    ctx.restore();
  }
}
