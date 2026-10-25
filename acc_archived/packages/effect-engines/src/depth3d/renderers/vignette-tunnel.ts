import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';

export class VignetteTunnelRenderer implements IDepth3DRenderer {
  readonly mode = 'vignette_tunnel';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    drawImageCover(ctx, img, 0, 0, width, height);
    if (subjectImg) drawImageCover(ctx, subjectImg, 0, 0, width, height);

    // Radial Volumetric Vignette & Spotlight
    const spotX = width / 2 + Math.sin(timeSec * Math.PI * 0.5) * width * 0.08;
    const spotY = height / 2;

    const vigGrad = ctx.createRadialGradient(spotX, spotY, width * 0.20, spotX, spotY, width * 0.75);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(0.7, 'rgba(5, 5, 12, 0.55)');
    vigGrad.addColorStop(1, 'rgba(2, 2, 8, 0.92)');

    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }
}
