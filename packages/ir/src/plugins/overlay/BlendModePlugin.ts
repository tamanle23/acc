import type { ModifierPlugin, ModifierContext, MasterCompositeContext } from '../ModifierPluginRegistry';

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
  public readonly targetScope = 'both';
  public readonly targetPhase = 4;

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

