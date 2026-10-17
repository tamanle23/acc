import type { ModifierPlugin, ModifierContext } from '../ModifierPluginRegistry';
import type { AudioProcessContext } from '../IVideoPluginStrategy';

export interface VolumeModifierParams {
  volume?: number;       // Linear volume multiplier (0.0 to 2.0, default: 1.0)
  fadeInSec?: number;    // Intro fade-in duration in seconds
  fadeOutSec?: number;   // Outro fade-out duration in seconds
  fadeCurve?: 'linear' | 'cosine' | 'exponential';
  muted?: boolean;
}

/**
 * VolumeModifierPlugin:
 * Pure Float32 DSP modifier for clip/track volume scaling and fade envelopes.
 * Phase 4 / Audio DSP execution.
 */
export class VolumeModifierPlugin implements ModifierPlugin<VolumeModifierParams> {
  public readonly type = 'audio/volume';
  public readonly targetScope = 'both';
  public readonly targetPhase = 4;

  public validate(params: unknown): params is VolumeModifierParams {
    return Boolean(
      params &&
        typeof params === 'object' &&
        (!('volume' in params) || typeof (params as any).volume === 'number')
    );
  }

  public execute(context: ModifierContext, params: VolumeModifierParams): void {
    if (!context.state) context.state = {};
    context.state.audioVolume = {
      volume: params.volume ?? 1.0,
      fadeInSec: params.fadeInSec ?? 0,
      fadeOutSec: params.fadeOutSec ?? 0,
      muted: params.muted ?? false,
    };
  }

  public processAudioStream(
    ctx: AudioProcessContext,
    buffer: Float32Array,
    params: VolumeModifierParams
  ): void {
    if (params.muted) {
      buffer.fill(0);
      return;
    }

    const volume = params.volume ?? 1.0;
    const sampleRate = ctx.sampleRate || 44100;
    const timeOffsetSec = ctx.timeSec ?? 0;
    const clipDurationSec = ctx.durationSec ?? (buffer.length / sampleRate);
    const fadeInSec = params.fadeInSec ?? 0;
    const fadeOutSec = params.fadeOutSec ?? 0;
    const curve = params.fadeCurve ?? 'cosine';

    for (let i = 0; i < buffer.length; i++) {
      const t = timeOffsetSec + (i / sampleRate);
      let envelope = 1.0;

      // Fade-in envelope
      if (fadeInSec > 0 && t < fadeInSec) {
        const progress = Math.max(0, Math.min(1.0, t / fadeInSec));
        envelope = curve === 'cosine'
          ? Math.sin((progress * Math.PI) / 2)
          : progress;
      }

      // Fade-out envelope
      if (fadeOutSec > 0 && t > (clipDurationSec - fadeOutSec)) {
        const remaining = Math.max(0, clipDurationSec - t);
        const progress = Math.max(0, Math.min(1.0, remaining / fadeOutSec));
        const outFactor = curve === 'cosine'
          ? Math.sin((progress * Math.PI) / 2)
          : progress;
        envelope = Math.min(envelope, outFactor);
      }

      buffer[i] *= volume * envelope;
    }
  }
}
