import type { ModifierPlugin, ModifierContext } from '../ModifierPluginRegistry';
import type { AudioProcessContext } from '../IVideoPluginStrategy';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';

export interface PitchModifierParams {
  playbackRate?: number; // Speed/pitch factor (e.g. 0.5 to 2.0, default: 1.0)
  detuneCents?: number;  // Detuning in cents (-1200 to +1200, 100 cents = 1 semitone)
}

/**
 * PitchModifierPlugin:
 * Resamples audio PCM buffer according to playbackRate and detune parameters.
 */
export class PitchModifierPlugin implements ModifierPlugin<PitchModifierParams> {
  public readonly type = 'audio/pitch';
  public readonly targetScope: ModifierTargetScope = 'sequence';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['audio', 'video'];
  public readonly targetPhase = 4;
  public readonly schema = {
    fields: {
      playbackRate: {
        key: 'playbackRate',
        label: 'Playback Rate',
        type: 'number' as const,
        min: 0.25,
        max: 3.0,
        step: 0.05,
        defaultValue: 1.0,
        unit: 'x',
      },
      detuneCents: {
        key: 'detuneCents',
        label: 'Detune Shift',
        type: 'number' as const,
        min: -1200,
        max: 1200,
        step: 25,
        defaultValue: 0,
        unit: 'cents',
      },
    },
  };

  public validate(params: unknown): params is PitchModifierParams {
    return Boolean(
      params &&
        typeof params === 'object' &&
        (!('playbackRate' in params) || typeof (params as any).playbackRate === 'number') &&
        (!('detuneCents' in params) || typeof (params as any).detuneCents === 'number')
    );
  }

  public execute(context: ModifierContext, params: PitchModifierParams): void {
    if (!context.state) context.state = {};
    let rate = params.playbackRate ?? 1.0;
    if (params.detuneCents) {
      rate *= Math.pow(2, params.detuneCents / 1200);
    }
    context.state.audioPitch = {
      effectiveRate: Math.max(0.1, Math.min(4.0, rate)),
    };
  }

  public processAudioStream(
    _ctx: AudioProcessContext,
    buffer: Float32Array,
    params: PitchModifierParams
  ): void {
    let rate = params.playbackRate ?? 1.0;
    if (params.detuneCents) {
      rate *= Math.pow(2, params.detuneCents / 1200);
    }
    rate = Math.max(0.1, Math.min(4.0, rate));

    if (Math.abs(rate - 1.0) < 1e-4) {
      return; // Unity rate, no-op
    }

    const original = new Float32Array(buffer);
    const len = buffer.length;

    for (let i = 0; i < len; i++) {
      const srcIdx = i * rate;
      const idx0 = Math.floor(srcIdx);
      const frac = srcIdx - idx0;
      const idx1 = idx0 + 1;

      if (idx0 < len) {
        const s0 = original[idx0];
        const s1 = idx1 < len ? original[idx1] : s0;
        buffer[i] = s0 + frac * (s1 - s0);
      } else {
        buffer[i] = 0;
      }
    }
  }
}
