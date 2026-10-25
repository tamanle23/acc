import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';

export class IsometricPodiumRenderer implements IDepth3DRenderer {
  readonly mode = 'isometric_podium';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);

    // Draw background plate
    ctx.save();
    ctx.globalAlpha = 0.35;
    drawImageCover(ctx, img, 0, 0, width, height, 1.05);
    ctx.restore();

    // Calculate 3D Podium Geometry
    const centerX = width / 2;
    const centerY = height * 0.72 + Math.sin(timeSec * Math.PI * 0.8) * 6;
    const radiusX = width * 0.28;
    const radiusY = height * 0.09;
    const podiumHeight = height * 0.12;

    // Draw 3D Podium Cylinder Base
    const podGrad = ctx.createLinearGradient(centerX - radiusX, centerY, centerX + radiusX, centerY);
    podGrad.addColorStop(0, '#1e2038');
    podGrad.addColorStop(0.5, '#3b3e66');
    podGrad.addColorStop(1, '#151628');

    ctx.fillStyle = podGrad;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + podiumHeight, radiusX, radiusY, 0, 0, Math.PI);
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();

    // Top Ellipse Ring
    const topGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radiusX);
    topGrad.addColorStop(0, '#555988');
    topGrad.addColorStop(0.85, '#2d304d');
    topGrad.addColorStop(1, '#888cc8');

    ctx.fillStyle = topGrad;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#a0a5e8';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw Subject sitting on podium
    const targetImg = subjectImg || img;
    const subH = height * 0.58;
    const subW = subH * (targetImg.width / targetImg.height);
    const subX = centerX - subW / 2;
    const subY = centerY - subH + radiusY * 0.6;

    // Contact Cast Shadow on Podium Top
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - 5, subW * 0.38, radiusY * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(targetImg, subX, subY, subW, subH);

    ctx.restore();
  }
}
