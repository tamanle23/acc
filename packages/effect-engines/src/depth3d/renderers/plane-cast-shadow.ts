import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';

export class PlaneCastShadowRenderer implements IDepth3DRenderer {
  readonly mode = 'plane_cast_shadow';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height } = state;
    ctx.save();
    ctx.fillStyle = '#10121e';
    ctx.fillRect(0, 0, width, height);

    // Ground Floor Plane Divider
    const groundY = height * 0.75;
    ctx.fillStyle = '#080910';
    ctx.fillRect(0, groundY, width, height - groundY);

    const targetImg = subjectImg || img;
    const subH = height * 0.65;
    const subW = subH * (targetImg.width / targetImg.height);
    const subX = (width - subW) / 2;
    const subY = groundY - subH + 15;

    // Perspective Cast Shadow Skewed onto Ground Plane
    ctx.save();
    ctx.translate(width / 2, groundY);
    ctx.transform(1, 0, -0.8, 0.28, 0, 0); // Skew shadow onto ground
    ctx.translate(-width / 2, -groundY);

    ctx.fillStyle = 'black';
    ctx.globalAlpha = 0.55;
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 15;
    ctx.drawImage(targetImg, subX, groundY - subH, subW, subH);
    ctx.restore();

    // Subject Stand Upright
    ctx.save();
    ctx.drawImage(targetImg, subX, subY, subW, subH);
    ctx.restore();

    ctx.restore();
  }
}
