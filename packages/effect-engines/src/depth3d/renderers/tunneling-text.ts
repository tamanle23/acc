import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';

export class TunnelingTextRenderer implements IDepth3DRenderer {
  readonly mode = 'tunneling_text';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { width, height, timeSec, progress, captions = [] } = state;
    ctx.save();
    ctx.fillStyle = '#020206';
    ctx.fillRect(0, 0, width, height);

    const activeText = captions.length > 0 ? captions[0].text : 'TUNNEL VISION';
    const ringCount = 7;

    for (let i = ringCount - 1; i >= 0; i--) {
      const ringProgress = (progress + i / ringCount) % 1.0;
      const scale = Math.pow(ringProgress, 2.5) * 1.8 + 0.05;
      const alpha = Math.sin(ringProgress * Math.PI);

      if (alpha <= 0.02) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      const fontSize = Math.round(width * 0.07 * scale);
      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = `hsl(${(i * 50 + timeSec * 100) % 360}, 100%, 70%)`;
      ctx.fillText(activeText.toUpperCase(), width / 2, height / 2);
      ctx.restore();
    }

    ctx.restore();
  }
}
