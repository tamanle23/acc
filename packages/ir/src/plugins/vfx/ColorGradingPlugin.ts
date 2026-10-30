import type { ModifierPlugin, ModifierContext, ClipRenderContext, MasterCompositeContext } from '../ModifierPluginRegistry';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';
import {
  resolveLutPreset,
  applyColorCorrectionAndGrading,
  type ColorWheelValue,
  type StudioColorPipelineParams,
  LUT_PRESET_KEYS,
} from '../lut';

export type { ColorWheelValue };

export interface ColorGradingParams extends StudioColorPipelineParams {
  lutPath?: string;
  lutUrl?: string;
}

/**
 * ColorGradingPlugin:
 * Professional Studio-Grade Color Correction & Color Grading Plugin ('vfx/color_grading').
 *
 * Architecture:
 * - Phase 1 (Color Correction): Planckian White Balance (Temp/Tint), Photometric Exposure (EV),
 *   3-Way Color Wheels (Lift, Gamma, Gain, Offset), Highlights/Shadows Rolloff, Whites/Blacks Anchors,
 *   Contrast with 18% Mid-Gray Pivot.
 * - Phase 2 (Creative Color Grading): 3D LUT Tetrahedral Interpolation with Blend Intensity (0-100%),
 *   Smart Vibrance & Master Saturation.
 * - Phase 3 (Finishing): Radial Smoothstep Vignette.
 *
 * Fully isomorphic within @acc/ir: executes in browser canvas, workers, and headless renderers
 * with zero dependencies on @acc/effect-engines.
 */
export class ColorGradingPlugin implements ModifierPlugin<ColorGradingParams> {
  public readonly type = 'vfx/color_grading';
  public readonly targetScope: ModifierTargetScope = 'sequence';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['video', 'image'];
  public readonly targetPhase = 2;

  public readonly schema = {
    fields: {
      // --- Stage 1: Primary Color Correction ---
      temperature: {
        key: 'temperature',
        label: 'Color Temperature',
        type: 'number' as const,
        min: -100,
        max: 100,
        step: 1,
        defaultValue: 0,
        unit: 'K',
      },
      tint: {
        key: 'tint',
        label: 'Tint (Green / Magenta)',
        type: 'number' as const,
        min: -100,
        max: 100,
        step: 1,
        defaultValue: 0,
      },
      exposure: {
        key: 'exposure',
        label: 'Exposure',
        type: 'number' as const,
        min: -3.0,
        max: 3.0,
        step: 0.05,
        defaultValue: 0.0,
        unit: 'EV',
      },
      contrast: {
        key: 'contrast',
        label: 'Contrast',
        type: 'number' as const,
        min: 0.2,
        max: 2.5,
        step: 0.05,
        defaultValue: 1.0,
      },
      pivot: {
        key: 'pivot',
        label: 'Contrast Pivot',
        type: 'number' as const,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultValue: 0.435,
      },
      highlights: {
        key: 'highlights',
        label: 'Highlights',
        type: 'number' as const,
        min: -100,
        max: 100,
        step: 1,
        defaultValue: 0,
      },
      shadows: {
        key: 'shadows',
        label: 'Shadows',
        type: 'number' as const,
        min: -100,
        max: 100,
        step: 1,
        defaultValue: 0,
      },
      whites: {
        key: 'whites',
        label: 'Whites',
        type: 'number' as const,
        min: -100,
        max: 100,
        step: 1,
        defaultValue: 0,
      },
      blacks: {
        key: 'blacks',
        label: 'Blacks',
        type: 'number' as const,
        min: -100,
        max: 100,
        step: 1,
        defaultValue: 0,
      },

      // --- Stage 2: Creative Color Grading ---
      lut: {
        key: 'lut',
        label: 'LUT Look Preset',
        type: 'select' as const,
        options: [
          { value: '', label: 'None (Bypass LUT)' },
          { value: 'teal_and_orange', label: 'Teal & Orange (Blockbuster)' },
          { value: 'kodak_2383', label: 'Kodak 2383 Print Film' },
          { value: 'bleach_bypass', label: 'Bleach Bypass (Gritty)' },
          { value: 'sci_fi_moody', label: 'Sci-Fi Moody (Thriller)' },
          { value: 'cool_steel', label: 'Cool Steel (Futuristic)' },
          { value: 'warm_golden', label: 'Warm Golden (Sunset)' },
          { value: 'light_and_airy', label: 'Light & Airy (Pastel)' },
          { value: 'cyberpunk', label: 'Cyberpunk (Neon Night)' },
          { value: 'vintage_faded', label: 'Vintage Faded (90s VHS)' },
          { value: 'monochrome_noir', label: 'Monochrome Noir (Dramatic)' },
        ],
        defaultValue: '',
      },
      lutIntensity: {
        key: 'lutIntensity',
        label: 'LUT Look Intensity',
        type: 'number' as const,
        min: 0.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 1.0,
      },
      saturation: {
        key: 'saturation',
        label: 'Saturation',
        type: 'number' as const,
        min: 0.0,
        max: 3.0,
        step: 0.05,
        defaultValue: 1.0,
      },
      vibrance: {
        key: 'vibrance',
        label: 'Vibrance',
        type: 'number' as const,
        min: -100,
        max: 100,
        step: 1,
        defaultValue: 0,
      },

      // --- Stage 3: Vignette & Finishing ---
      vignetteAmount: {
        key: 'vignetteAmount',
        label: 'Vignette Amount',
        type: 'number' as const,
        min: -1.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.0,
      },
      vignetteMidpoint: {
        key: 'vignetteMidpoint',
        label: 'Vignette Midpoint',
        type: 'number' as const,
        min: 0.1,
        max: 0.9,
        step: 0.05,
        defaultValue: 0.5,
      },
      vignetteFeather: {
        key: 'vignetteFeather',
        label: 'Vignette Feather',
        type: 'number' as const,
        min: 0.1,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.5,
      },
    },
  };

  public readonly supportedPresets: readonly string[] = LUT_PRESET_KEYS;

  public validate(params: unknown): params is ColorGradingParams {
    return Boolean(params && typeof params === 'object');
  }

  public async execute(context: ModifierContext, params: ColorGradingParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.colorGrading = params;
  }

  /**
   * Applies CSS tone-mapping canvas transforms (fallback tier).
   */
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
   * Generates headless FFmpeg video filters for color grading parameters.
   */
  public generateFFmpegFilter(params: ColorGradingParams): string {
    return ColorGradingPlugin.generateFFmpegFilter(params);
  }

  public static generateFFmpegFilter(params: ColorGradingParams): string {
    const filters: string[] = [];

    const contrast = params.contrast ?? 1.0;
    const saturation = params.saturation ?? 1.0;
    const exposure = params.exposure ?? 0.0;

    if (contrast !== 1.0 || saturation !== 1.0 || exposure !== 0.0) {
      filters.push(`eq=contrast=${contrast.toFixed(2)}:saturation=${saturation.toFixed(2)}:brightness=${exposure.toFixed(2)}`);
    }

    if (params.lutPath) {
      filters.push(`lut3d=file='${params.lutPath}':interp=tetrahedral`);
    }

    return filters.length > 0 ? filters.join(',') : 'null';
  }

  /**
   * Applies unified studio-grade Color Correction and Color Grading directly onto canvas context.
   */
  public applyColorCorrectionAndGradingToCanvas(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    params: ColorGradingParams,
    lutData?: Float32Array,
    lutSize: number = 17
  ): void {
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    applyColorCorrectionAndGrading(imageData, params, lutData, lutSize);
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Backwards-compatible 3D LUT applicator.
   */
  public applyLutToCanvas(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    lutData: Float32Array,
    size: number
  ): void {
    this.applyColorCorrectionAndGradingToCanvas(ctx, {}, lutData, size);
  }

  public async renderClipSpace(ctx: ClipRenderContext, params: ColorGradingParams): Promise<void> {
    const { ctx: canvasCtx } = ctx;
    let resolvedLut: { data: Float32Array; size: number } | null = null;

    if (params.lut) {
      try {
        resolvedLut = await resolveLutPreset(params.lut, 17);
      } catch {
        // Graceful degradation
      }
    }

    this.applyColorCorrectionAndGradingToCanvas(
      canvasCtx,
      params,
      resolvedLut?.data,
      resolvedLut?.size ?? 17
    );
  }

  public async renderMasterComposite(ctx: MasterCompositeContext, params: ColorGradingParams): Promise<void> {
    const { ctx: canvasCtx } = ctx;
    let resolvedLut: { data: Float32Array; size: number } | null = null;

    if (params.lut) {
      try {
        resolvedLut = await resolveLutPreset(params.lut, 17);
      } catch {
        // Graceful degradation
      }
    }

    this.applyColorCorrectionAndGradingToCanvas(
      canvasCtx,
      params,
      resolvedLut?.data,
      resolvedLut?.size ?? 17
    );
  }
}
