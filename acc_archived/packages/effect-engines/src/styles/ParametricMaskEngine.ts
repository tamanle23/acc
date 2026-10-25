export interface MaskEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  featherPx?: number;
}

export class ParametricMaskEngine {
  public static applyEllipseMask(
    ctx: any,
    mask: MaskEllipse,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(mask.cx, mask.cy, mask.rx, mask.ry, 0, 0, 2 * Math.PI);
    ctx.clip();
  }

  public static generateFFmpegVignetteMask(canvasWidth: number, canvasHeight: number, intensity = 0.5): string {
    const angleRad = (intensity * (Math.PI / 4)).toFixed(2);
    return `vignette=angle=${angleRad}`;
  }
}
