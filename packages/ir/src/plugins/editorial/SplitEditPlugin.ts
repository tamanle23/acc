import type { ModifierPlugin, ModifierContext } from '../ModifierPluginRegistry';
import type { SequenceType } from '../../types/VideoIR';

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
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['video', 'audio'];
  public readonly schema = {
    fields: {
      mode: {
        key: 'mode',
        label: 'Split Edit Mode',
        type: 'select' as const,
        defaultValue: 'j_cut',
        options: [
          { label: 'J-Cut (Audio Leads Video)', value: 'j_cut' },
          { label: 'L-Cut (Audio Trails Video)', value: 'l_cut' },
        ],
      },
      splitDurationFrames: {
        key: 'splitDurationFrames',
        label: 'Split Offset Duration',
        type: 'number' as const,
        min: 1,
        max: 120,
        step: 1,
        defaultValue: 15,
        unit: 'f',
      },
      crossfadeAudio: {
        key: 'crossfadeAudio',
        label: 'Crossfade Audio Seam',
        type: 'boolean' as const,
        defaultValue: true,
      },
    },
  };

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
