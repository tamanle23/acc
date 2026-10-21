import type { ModifierPlugin, ModifierContext } from '../ModifierPluginRegistry';
import type { AudioProcessContext } from '../IVideoPluginStrategy';

export interface PanModifierParams {
  stereoPan: number; // -1.0 (hard left) to +1.0 (hard right), 0.0 (center)
}

/**
 * PanModifierPlugin:
 * Equal-power stereo panning modifier plugin operating on pure Float32Array PCM buffers.
 */
export class PanModifierPlugin implements ModifierPlugin<PanModifierParams> {
  public readonly type = 'audio/pan';
  public readonly targetScope = 'both';
  public readonly targetPhase = 4;
  public readonly schema = {
    fields: {
      stereoPan: {
        key: 'stereoPan',
        label: 'Stereo Pan Balance',
        type: 'number' as const,
        min: -1.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.0,
      },
    },
  };

  public validate(params: unknown): params is PanModifierParams {
    return Boolean(
      params &&
        typeof params === 'object' &&
        'stereoPan' in params &&
        typeof (params as any).stereoPan === 'number'
    );
  }

  public execute(context: ModifierContext, params: PanModifierParams): void {
    if (!context.state) context.state = {};
    context.state.audioPan = {
      stereoPan: Math.max(-1.0, Math.min(1.0, params.stereoPan)),
    };
  }

  /**
   * Applies equal-power stereo balance gains to left and right channel arrays.
   */
  public processStereoStream(
    _ctx: AudioProcessContext,
    left: Float32Array,
    right: Float32Array,
    params: PanModifierParams
  ): void {
    const pan = Math.max(-1.0, Math.min(1.0, params.stereoPan ?? 0.0));
    // Constant-power law: panAngle in [0, PI/2]
    const panAngle = ((pan + 1.0) / 2.0) * (Math.PI / 2.0);
    const gainL = Math.cos(panAngle);
    const gainR = Math.sin(panAngle);

    const length = Math.min(left.length, right.length);
    for (let i = 0; i < length; i++) {
      left[i] *= gainL;
      right[i] *= gainR;
    }
  }
}
