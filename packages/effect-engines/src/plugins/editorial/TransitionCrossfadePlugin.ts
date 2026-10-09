import type { ModifierPlugin, ModifierContext } from '../ModifierPluginRegistry';

export interface TransitionCrossfadeParams {
  durationFrames: number;
  overlapTarget?: string;
}

/**
 * TransitionCrossfadePlugin:
 * Implements video/audio crossfade transitions (`transition/crossfade`).
 */
export class TransitionCrossfadePlugin implements ModifierPlugin<TransitionCrossfadeParams> {
  public readonly type = 'transition/crossfade';
  public readonly targetScope = 'sequence';

  public validate(params: unknown): params is TransitionCrossfadeParams {
    return Boolean(
      params &&
        typeof params === 'object' &&
        'durationFrames' in params &&
        typeof (params as any).durationFrames === 'number'
    );
  }

  public async execute(context: ModifierContext, params: TransitionCrossfadeParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.transition = {
      type: 'fade',
      durationFrames: params.durationFrames,
      overlapTarget: params.overlapTarget,
    };
  }
}
