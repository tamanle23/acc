import type { ModifierPlugin, ModifierContext } from '../ModifierPluginRegistry';

export interface BlendModeParams {
  mode: 'multiply' | 'screen' | 'overlay' | 'color_dodge' | 'soft_light';
  opacity?: number;
}

/**
 * BlendModePlugin:
 * Implements algebraic layer blend modes (`overlay/blend_mode`).
 */
export class BlendModePlugin implements ModifierPlugin<BlendModeParams> {
  public readonly type = 'overlay/blend_mode';
  public readonly targetScope = 'both';

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
}
