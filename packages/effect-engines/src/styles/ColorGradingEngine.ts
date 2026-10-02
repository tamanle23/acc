export interface ColorGradingParams {
  lutPath?: string;
  contrast?: number; // 0.5 to 2.0 (default 1.0)
  saturation?: number; // 0.0 to 2.0 (default 1.0)
  exposure?: number; // -2.0 to +2.0 (default 0.0)
  temperature?: number; // -100 to +100 (warm/cool, default 0)
}

export interface IColorGradingStrategy {
  readonly id: string;
  generateFFmpegFilter(params: ColorGradingParams): string;
  applyCanvasTransform(ctx: any, params: ColorGradingParams): void;
}

export class ColorGradingEngine implements IColorGradingStrategy {
  public readonly id = '3d_lut_color_grading';

  public generateFFmpegFilter(params: ColorGradingParams): string {
    const filters: string[] = [];

    const contrast = params.contrast ?? 1.0;
    const saturation = params.saturation ?? 1.0;
    const exposure = params.exposure ?? 0.0;

    // eq filter for contrast, saturation, brightness
    if (contrast !== 1.0 || saturation !== 1.0 || exposure !== 0.0) {
      filters.push(`eq=contrast=${contrast.toFixed(2)}:saturation=${saturation.toFixed(2)}:brightness=${exposure.toFixed(2)}`);
    }

    if (params.lutPath) {
      filters.push(`lut3d=file='${params.lutPath}':interp=tetrahedral`);
    }

    return filters.length > 0 ? filters.join(',') : 'null';
  }

  public applyCanvasTransform(ctx: any, params: ColorGradingParams): void {
    if (typeof ctx.filter !== 'string') return;

    const contrastPct = Math.round((params.contrast ?? 1.0) * 100);
    const saturatePct = Math.round((params.saturation ?? 1.0) * 100);
    const brightnessPct = Math.round((1.0 + (params.exposure ?? 0.0)) * 100);

    const filterString = `contrast(${contrastPct}%) saturate(${saturatePct}%) brightness(${brightnessPct}%)`;
    ctx.filter = ctx.filter && ctx.filter !== 'none' ? `${ctx.filter} ${filterString}` : filterString;
  }
}
