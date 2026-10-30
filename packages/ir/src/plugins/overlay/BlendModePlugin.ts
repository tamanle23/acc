import type { ModifierPlugin, ModifierContext, MasterCompositeContext } from '../ModifierPluginRegistry';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';

export interface BlendModeParams {
  mode: 'multiply' | 'screen' | 'overlay' | 'color_dodge' | 'soft_light';
  opacity?: number;
}

/**
 * BlendModePlugin:
 * Implements algebraic layer blend modes (`overlay/blend_mode`).
 * Phase 4: Master Canvas Compositing & Handshake.
 */
export class BlendModePlugin implements ModifierPlugin<BlendModeParams> {
  public readonly type = 'overlay/blend_mode';
  public readonly targetScope: ModifierTargetScope = 'sequence';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['video', 'image', 'overlay'];
  public readonly targetPhase = 4;
  public readonly schema = {
    fields: {
      mode: {
        key: 'mode',
        label: 'Composite Blend Mode',
        type: 'select' as const,
        defaultValue: 'screen',
        options: [
          { label: 'Screen (Additive Glow)', value: 'screen' },
          { label: 'Multiply (Darken)', value: 'multiply' },
          { label: 'Overlay (Contrast)', value: 'overlay' },
          { label: 'Color Dodge (Intense Highlights)', value: 'color_dodge' },
          { label: 'Soft Light (Subtle Wash)', value: 'soft_light' },
        ],
      },
      opacity: {
        key: 'opacity',
        label: 'Blend Opacity',
        type: 'number' as const,
        min: 0.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 1.0,
      },
    },
  };

  public validate(params: unknown): params is BlendModeParams {
    return Boolean(
      params &&
        typeof params === 'object' &&
        'mode' in params
    );
  }

  public async execute(context: ModifierContext, params: BlendModeParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.blendMode = {
      mode: params.mode,
      opacity: params.opacity ?? 1.0,
    };
  }

  public renderMasterComposite(ctx: MasterCompositeContext, params: BlendModeParams): void {
    const { ctx: canvasCtx } = ctx;
    const modeMap: Record<string, string> = {
      multiply: 'multiply',
      screen: 'screen',
      overlay: 'overlay',
      color_dodge: 'color-dodge',
      soft_light: 'soft-light',
    };
    canvasCtx.globalCompositeOperation = modeMap[params.mode] || 'source-over';
    canvasCtx.globalAlpha = params.opacity ?? 1.0;
  }
}

