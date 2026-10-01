import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';

export class SilhouetteRimLightRenderer implements IDepth3DRenderer {
  readonly mode = 'silhouette_rim_light';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    ctx.fillStyle = '#040408';
    ctx.fillRect(0, 0, width, height);

    // Dim Background Plate
    ctx.save();
    ctx.globalAlpha = 0.30;
    drawImageCover(ctx, img, 0, 0, width, height);
    ctx.restore();

    const targetImg = subjectImg || img;
    const subH = height * 0.82;
    const subW = subH * (targetImg.width / targetImg.height);
    const subX = (width - subW) / 2;
    const subY = height - subH;

    // Render Backlight Rim Contour Glow
    ctx.save();
    const glowPulse = 18 + Math.sin(timeSec * Math.PI * 1.5) * 8;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = glowPulse;
    ctx.shadowOffsetX = -6;
    ctx.shadowOffsetY = -6;
    ctx.drawImage(targetImg, subX, subY, subW, subH);

    ctx.shadowColor = '#ff0077';
    ctx.shadowBlur = glowPulse;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(targetImg, subX, subY, subW, subH);
    ctx.restore();

    // Front Subject Pass
    ctx.save();
    ctx.drawImage(targetImg, subX, subY, subW, subH);
    ctx.restore();

    ctx.restore();
  }
}
