export interface InpaintRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CleanPlateEngine {
  public static generateFFmpegInpaintFilter(region: InpaintRegion): string {
    return `delogo=x=${region.x}:y=${region.y}:w=${region.width}:h=${region.height}`;
  }
}
