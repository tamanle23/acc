import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';

export class PerspectiveGridRenderer implements IDepth3DRenderer {
  readonly mode = 'perspective_grid';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, frame } = state;
    ctx.save();
    ctx.fillStyle = '#030308';
    ctx.fillRect(0, 0, width, height);

    // Draw Background Sky
    ctx.save();
    ctx.globalAlpha = 0.40;
    drawImageCover(ctx, img, 0, 0, width, height * 0.55);
    ctx.restore();

    // 3D Moving Perspective Ground Grid
    const horizonY = height * 0.52;
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;

    // Vanishing perspective lines radiating from horizon center
    const vanishX = width / 2;
    const lineCount = 18;
    for (let i = -lineCount / 2; i <= lineCount / 2; i++) {
      const targetX = vanishX + i * (width * 0.12);
      ctx.beginPath();
      ctx.moveTo(vanishX, horizonY);
      ctx.lineTo(targetX, height);
      ctx.stroke();
    }

    // Horizontal receding depth grid lines
    const speed = (frame * 3) % 40;
    for (let y = horizonY; y < height; y += (y - horizonY) * 0.18 + 4) {
      const drawY = y + speed * ((y - horizonY) / height);
      if (drawY > height) continue;
      ctx.beginPath();
      ctx.moveTo(0, drawY);
      ctx.lineTo(width, drawY);
      ctx.stroke();
    }
    ctx.restore();

    // Subject Standing on Grid Horizon
    const targetImg = subjectImg || img;
    const subH = height * 0.55;
    const subW = subH * (targetImg.width / targetImg.height);
    const subX = (width - subW) / 2;
    const subY = horizonY - subH + 20;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 20;
    ctx.drawImage(targetImg, subX, subY, subW, subH);
    ctx.restore();

    ctx.restore();
  }
}
