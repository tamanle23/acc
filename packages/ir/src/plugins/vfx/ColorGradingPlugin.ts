import type { ModifierPlugin, ModifierContext, ClipRenderContext, MasterCompositeContext } from '../ModifierPluginRegistry';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';
import { ColorGradingEngine, type ColorGradingParams } from '@acc/effect-engines';

/**
 * ColorGradingPlugin:
 * Implements in-memory LUT and contrast/saturation adjustment ('vfx/color_grading').
 * Applies during Phase 2 (clip space) or Phase 4 (master composite).
 */
export class ColorGradingPlugin implements ModifierPlugin<ColorGradingParams> {
  public readonly type = 'vfx/color_grading';
  public readonly targetScope: ModifierTargetScope = 'sequence';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['video', 'image'];
  public readonly targetPhase = 2;
  public readonly schema = {
    fields: {
      contrast: {
        key: 'contrast',
        label: 'Contrast',
        type: 'number' as const,
        min: 0.2,
        max: 2.5,
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
      exposure: {
        key: 'exposure',
        label: 'Exposure',
        type: 'number' as const,
        min: -1.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.0,
        unit: 'EV',
      },
      temperature: {
        key: 'temperature',
        label: 'Color Temperature',
        type: 'number' as const,
        min: -100,
        max: 100,
        step: 1,
        defaultValue: 0,
      },
      tint: {
        key: 'tint',
        label: 'Magenta/Green Tint',
        type: 'number' as const,
        min: -100,
        max: 100,
        step: 1,
        defaultValue: 0,
      },
      vignette: {
        key: 'vignette',
        label: 'Vignette Falloff',
        type: 'number' as const,
        min: 0.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.0,
      },
    },
  };

  private engine = new ColorGradingEngine();

  public validate(params: unknown): params is ColorGradingParams {
    return Boolean(params && typeof params === 'object');
  }

  public async execute(context: ModifierContext, params: ColorGradingParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.colorGrading = params;
  }

  public renderClipSpace(ctx: ClipRenderContext, params: ColorGradingParams): void {
    const { ctx: canvasCtx } = ctx;
    this.engine.applyCanvasTransform(canvasCtx, params);
  }

  public renderMasterComposite(ctx: MasterCompositeContext, params: ColorGradingParams): void {
    const { ctx: canvasCtx } = ctx;
    this.engine.applyCanvasTransform(canvasCtx, params);
  }
}
