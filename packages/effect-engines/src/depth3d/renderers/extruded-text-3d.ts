import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';

export class ExtrudedText3DRenderer implements IDepth3DRenderer {
  readonly mode = 'extruded_text_3d';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, width, height, timeSec, captions = [] } = state;
    ctx.save();
    ctx.fillStyle = '#060610';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.25;
    drawImageCover(ctx, img, 0, 0, width, height);
    ctx.restore();

    const titleText = captions.length > 0 ? captions[0].text : '3D EXTRUDED';
    const fontSize = Math.round(width * 0.085);
    const centerX = width / 2;
    const centerY = height / 2 + Math.sin(timeSec * Math.PI * 0.8) * 10;

    ctx.font = `900 ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Render 3D Extrusion Stack
    const depthLayers = 16;
    for (let i = depthLayers; i >= 1; i--) {
      ctx.fillStyle = `rgb(${Math.round(15 + i * 8)}, ${Math.round(20 + i * 10)}, ${Math.round(40 + i * 12)})`;
      ctx.fillText(titleText.toUpperCase(), centerX + i * 1.5, centerY + i * 2.0);
    }

    // Front Face Pass with Metallic Gradient
    const frontGrad = ctx.createLinearGradient(0, centerY - fontSize / 2, 0, centerY + fontSize / 2);
    frontGrad.addColorStop(0, '#ffffff');
    frontGrad.addColorStop(0.5, '#00e5ff');
    frontGrad.addColorStop(1, '#7600ff');

    ctx.fillStyle = frontGrad;
    ctx.fillText(titleText.toUpperCase(), centerX, centerY);

    ctx.restore();
  }
}
