import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';

export class CutoutPortalRenderer implements IDepth3DRenderer {
  readonly mode = 'cutout_portal';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec, progress } = state;
    ctx.save();
    // Inner Environment / Space beneath
    ctx.fillStyle = '#05050b';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    const bgScale = 1.0 + progress * 0.12;
    drawImageCover(ctx, img, 0, 0, width, height, bgScale);
    ctx.restore();

    // Draw Portal Cutout Outer Frame
    const portalRadius = (0.35 + Math.sin(timeSec * Math.PI * 0.5) * 0.03) * Math.min(width, height);
    const centerX = width / 2;
    const centerY = height * 0.48;

    // Outer Dark Vignette Frame with Portal Cutout Hole
    ctx.save();
    ctx.fillStyle = '#030306';
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(centerX, centerY, portalRadius, 0, Math.PI * 2, true);
    ctx.fill();

    // Glowing Neon Portal Edge Ring
    ctx.lineWidth = 12;
    const ringGrad = ctx.createConicGradient(timeSec, centerX, centerY);
    ringGrad.addColorStop(0, '#ff0055');
    ringGrad.addColorStop(0.33, '#00e5ff');
    ringGrad.addColorStop(0.66, '#7600ff');
    ringGrad.addColorStop(1, '#ff0055');
    ctx.strokeStyle = ringGrad;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 24;
    ctx.stroke();
    ctx.restore();

    // Subject Popping OUT of the Portal Ring
    if (subjectImg) {
      ctx.save();
      const scale = 1.05 + Math.sin(timeSec * Math.PI * 0.6) * 0.02;
      const subH = height * 0.68 * scale;
      const subW = subH * (subjectImg.width / subjectImg.height);
      const subX = centerX - subW / 2;
      const subY = centerY - subH * 0.55;

      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetY = 15;
      ctx.drawImage(subjectImg, subX, subY, subW, subH);
      ctx.restore();
    }

    ctx.restore();
  }
}
