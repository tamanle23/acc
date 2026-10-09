import type { ModifierPlugin, ModifierContext } from '../ModifierPluginRegistry';

export interface SplitEditParams {
  mode: 'j_cut' | 'l_cut';
  splitDurationFrames: number;
  crossfadeAudio?: boolean;
}

/**
 * SplitEditPlugin:
 * Implements cinematic J-Cut and L-Cut editorial transitions (`editorial/split_edit`).
 * Decouples audio lead-in / post-roll from visual cuts.
 */
export class SplitEditPlugin implements ModifierPlugin<SplitEditParams> {
  public readonly type = 'editorial/split_edit';
  public readonly targetScope = 'sequence';

  public validate(params: unknown): params is SplitEditParams {
    return Boolean(
      params &&
        typeof params === 'object' &&
        'mode' in params &&
        'splitDurationFrames' in params
    );
  }

  public async execute(context: ModifierContext, params: SplitEditParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.splitEdit = {
      mode: params.mode,
      splitDurationFrames: params.splitDurationFrames,
      crossfadeAudio: params.crossfadeAudio ?? true,
    };
  }
}
