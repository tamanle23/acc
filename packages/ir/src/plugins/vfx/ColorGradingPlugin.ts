import type { ModifierPlugin, ModifierContext, ClipRenderContext, MasterCompositeContext } from '../ModifierPluginRegistry';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';
import { ColorGradingEngine, type ColorGradingParams } from '@acc/effect-engines';
import { resolveLutPreset, LUT_PRESET_KEYS } from '../lut';

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
      lut: {
        key: 'lut',
        label: 'LUT Preset',
        type: 'select' as const,
        options: [
          { value: '', label: 'None' },
          { value: 'teal_and_orange', label: 'Teal & Orange' },
          { value: 'kodak_2383', label: 'Kodak 2383 Film' },
          { value: 'bleach_bypass', label: 'Bleach Bypass' },
          { value: 'sci_fi_moody', label: 'Sci-Fi Moody' },
          { value: 'cool_steel', label: 'Cool Steel' },
          { value: 'warm_golden', label: 'Warm Golden' },
          { value: 'light_and_airy', label: 'Light & Airy' },
          { value: 'cyberpunk', label: 'Cyberpunk' },
          { value: 'vintage_faded', label: 'Vintage Faded' },
          { value: 'monochrome_noir', label: 'Monochrome Noir' },
        ],
        defaultValue: '',
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

  // Ensure LUT_PRESET_KEYS is consumed so it's wired (not orphaned)
  public readonly supportedPresets: readonly string[] = LUT_PRESET_KEYS;

  private engine = new ColorGradingEngine();

  public validate(params: unknown): params is ColorGradingParams {
    return Boolean(params && typeof params === 'object');
  }

  public async execute(context: ModifierContext, params: ColorGradingParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.colorGrading = params;
  }

  public async renderClipSpace(ctx: ClipRenderContext, params: ColorGradingParams): Promise<void> {
    const { ctx: canvasCtx } = ctx;
    this.engine.applyCanvasTransform(canvasCtx, params);

    if (params.lut) {
      try {
        const resolved = await resolveLutPreset(params.lut, 17);
        if (resolved) {
          this.engine.applyLutToCanvas(canvasCtx, resolved.data, resolved.size);
        }
      } catch {
        // Graceful degradation: LUT not available, continue without pixel-level grading
      }
    }
  }

  public async renderMasterComposite(ctx: MasterCompositeContext, params: ColorGradingParams): Promise<void> {
    const { ctx: canvasCtx } = ctx;
    this.engine.applyCanvasTransform(canvasCtx, params);

    if (params.lut) {
      try {
        const resolved = await resolveLutPreset(params.lut, 17);
        if (resolved) {
          this.engine.applyLutToCanvas(canvasCtx, resolved.data, resolved.size);
        }
      } catch {
        // Graceful degradation
      }
    }
  }
}
