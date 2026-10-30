export interface ColorGradingParams {
  lutPath?: string;
  lut?: string;       // named preset key (e.g. 'cool_steel', 'bleach_bypass')
  lutUrl?: string;    // URL/path to external .cube file (Phase 2 future)
  contrast?: number;  // 0.5 to 2.0 (default 1.0)
  saturation?: number; // 0.0 to 2.0 (default 1.0)
  exposure?: number;  // -2.0 to +2.0 (default 0.0)
  temperature?: number; // -100 to +100 (warm/cool, default 0)
  tint?: number;       // -100 to +100 (default 0)
  vignette?: number;   // 0.0 to 1.0 (default 0.0)
}

export interface IColorGradingStrategy {
  readonly id: string;
  generateFFmpegFilter(params: ColorGradingParams): string;
  applyCanvasTransform(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, params: ColorGradingParams): void;
  applyLutToCanvas(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, lutData: Float32Array, size: number): void;
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

  public applyCanvasTransform(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    params: ColorGradingParams
  ): void {
    if (typeof (ctx as CanvasRenderingContext2D).filter !== 'string') return;

    const contrastPct = Math.round((params.contrast ?? 1.0) * 100);
    const saturatePct = Math.round((params.saturation ?? 1.0) * 100);
    const brightnessPct = Math.round((1.0 + (params.exposure ?? 0.0)) * 100);

    const filterString = `contrast(${contrastPct}%) saturate(${saturatePct}%) brightness(${brightnessPct}%)`;
    const typedCtx = ctx as CanvasRenderingContext2D;
    typedCtx.filter = typedCtx.filter && typedCtx.filter !== 'none'
      ? `${typedCtx.filter} ${filterString}`
      : filterString;
  }

  /**
   * Applies a pre-baked 3D LUT to every pixel on the canvas via getImageData → tetrahedral
   * interp → putImageData. Must be called AFTER all compositing for the canvas region is done.
   *
   * @param ctx     - 2D rendering context (main or offscreen)
   * @param lutData - Float32Array from resolveLutPreset (size^3 * 3 floats, 0-1 range)
   * @param size    - LUT grid size (e.g. 17)
   */
  public applyLutToCanvas(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    lutData: Float32Array,
    size: number
  ): void {
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    ColorGradingEngine.applyLutToImageDataInternal(imageData, lutData, size);
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Internal pixel-level tetrahedral LUT applicator.
   * Inlined to keep @acc/effect-engines independent of @acc/ir package.
   */
  private static applyLutToImageDataInternal(
    imageData: ImageData,
    lutData: Float32Array,
    size: number
  ): void {
    const pixels = imageData.data;
    const sizeM1 = size - 1;

    for (let i = 0; i < pixels.length; i += 4) {
      const rIn = pixels[i]! / 255;
      const gIn = pixels[i + 1]! / 255;
      const bIn = pixels[i + 2]! / 255;

      const rx = rIn * sizeM1;
      const gx = gIn * sizeM1;
      const bx = bIn * sizeM1;

      const r0 = Math.floor(rx);
      const g0 = Math.floor(gx);
      const b0 = Math.floor(bx);

      const r1 = Math.min(r0 + 1, sizeM1);
      const g1 = Math.min(g0 + 1, sizeM1);
      const b1 = Math.min(b0 + 1, sizeM1);

      const fr = rx - r0;
      const fg = gx - g0;
      const fb = bx - b0;

      const [ro, go, bo] = ColorGradingEngine.tetrahedral(
        lutData, size, r0, g0, b0, r1, g1, b1, fr, fg, fb
      );

      pixels[i] = Math.round(Math.max(0, Math.min(1, ro)) * 255);
      pixels[i + 1] = Math.round(Math.max(0, Math.min(1, go)) * 255);
      pixels[i + 2] = Math.round(Math.max(0, Math.min(1, bo)) * 255);
    }
  }

  private static lutAt(
    data: Float32Array, size: number, r: number, g: number, b: number
  ): [number, number, number] {
    const idx = (b * size * size + g * size + r) * 3;
    return [data[idx]!, data[idx + 1]!, data[idx + 2]!];
  }

  private static tetrahedral(
    data: Float32Array, size: number,
    r0: number, g0: number, b0: number,
    r1: number, g1: number, b1: number,
    fr: number, fg: number, fb: number
  ): [number, number, number] {
    const c000 = ColorGradingEngine.lutAt(data, size, r0, g0, b0);
    const c100 = ColorGradingEngine.lutAt(data, size, r1, g0, b0);
    const c010 = ColorGradingEngine.lutAt(data, size, r0, g1, b0);
    const c110 = ColorGradingEngine.lutAt(data, size, r1, g1, b0);
    const c001 = ColorGradingEngine.lutAt(data, size, r0, g0, b1);
    const c101 = ColorGradingEngine.lutAt(data, size, r1, g0, b1);
    const c011 = ColorGradingEngine.lutAt(data, size, r0, g1, b1);
    const c111 = ColorGradingEngine.lutAt(data, size, r1, g1, b1);

    let rOut: number, gOut: number, bOut: number;

    if (fr >= fg && fg >= fb) {
      rOut = (1 - fr) * c000[0] + (fr - fg) * c100[0] + (fg - fb) * c110[0] + fb * c111[0];
      gOut = (1 - fr) * c000[1] + (fr - fg) * c100[1] + (fg - fb) * c110[1] + fb * c111[1];
      bOut = (1 - fr) * c000[2] + (fr - fg) * c100[2] + (fg - fb) * c110[2] + fb * c111[2];
    } else if (fr >= fb && fb >= fg) {
      rOut = (1 - fr) * c000[0] + (fr - fb) * c100[0] + (fb - fg) * c101[0] + fg * c111[0];
      gOut = (1 - fr) * c000[1] + (fr - fb) * c100[1] + (fb - fg) * c101[1] + fg * c111[1];
      bOut = (1 - fr) * c000[2] + (fr - fb) * c100[2] + (fb - fg) * c101[2] + fg * c111[2];
    } else if (fg >= fr && fr >= fb) {
      rOut = (1 - fg) * c000[0] + (fg - fr) * c010[0] + (fr - fb) * c110[0] + fb * c111[0];
      gOut = (1 - fg) * c000[1] + (fg - fr) * c010[1] + (fr - fb) * c110[1] + fb * c111[1];
      bOut = (1 - fg) * c000[2] + (fg - fr) * c010[2] + (fr - fb) * c110[2] + fb * c111[2];
    } else if (fg >= fb && fb >= fr) {
      rOut = (1 - fg) * c000[0] + (fg - fb) * c010[0] + (fb - fr) * c011[0] + fr * c111[0];
      gOut = (1 - fg) * c000[1] + (fg - fb) * c010[1] + (fb - fr) * c011[1] + fr * c111[1];
      bOut = (1 - fg) * c000[2] + (fg - fb) * c010[2] + (fb - fr) * c011[2] + fr * c111[2];
    } else if (fb >= fr && fr >= fg) {
      rOut = (1 - fb) * c000[0] + (fb - fr) * c001[0] + (fr - fg) * c101[0] + fg * c111[0];
      gOut = (1 - fb) * c000[1] + (fb - fr) * c001[1] + (fr - fg) * c101[1] + fg * c111[1];
      bOut = (1 - fb) * c000[2] + (fb - fr) * c001[2] + (fr - fg) * c101[2] + fg * c111[2];
    } else {
      rOut = (1 - fb) * c000[0] + (fb - fg) * c001[0] + (fg - fr) * c011[0] + fr * c111[0];
      gOut = (1 - fb) * c000[1] + (fb - fg) * c001[1] + (fg - fr) * c011[1] + fr * c111[1];
      bOut = (1 - fb) * c000[2] + (fb - fg) * c001[2] + (fg - fr) * c011[2] + fr * c111[2];
    }

    return [rOut, gOut, bOut];
  }
}
