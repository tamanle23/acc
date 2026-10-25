export interface RenderMotionGraphicsOptions {
  text: string;
  canvasWidth: number;
  canvasHeight: number;
  progress: number; // 0.0 to 1.0
}

export interface IMotionGraphicsStrategy {
  readonly id: string;
  renderFrame(ctx: any, options: RenderMotionGraphicsOptions): void;
}

export class KaraokeSubtitleMotionGraphics implements IMotionGraphicsStrategy {
  public readonly id = 'karaoke_subtitle';

  public renderFrame(ctx: any, options: RenderMotionGraphicsOptions): void {
    ctx.save();
    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(options.text, options.canvasWidth / 2, options.canvasHeight - 180);
    ctx.restore();
  }
}
