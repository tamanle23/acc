import type { ModifierPlugin, ModifierContext, AudioProcessContext } from '../ModifierPluginRegistry';

export interface DynamicDuckingParams {
  controlTrackId: string;
  attenuationDb: number;
  attackMs?: number;
  holdMs?: number;
  releaseMs?: number;
}

/**
 * DynamicDuckingPlugin:
 * Bridges audio sidechain compression into an IR audio modifier (`sfx/dynamic_ducking`).
 * Phase 3: Track-Level Execution (Stream Space).
 */
export class DynamicDuckingPlugin implements ModifierPlugin<DynamicDuckingParams> {
  public readonly type = 'sfx/dynamic_ducking';
  public readonly targetScope = 'both';
  public readonly targetPhase = 3;

  public validate(params: unknown): params is DynamicDuckingParams {
    return Boolean(
      params &&
        typeof params === 'object' &&
        'controlTrackId' in params &&
        'attenuationDb' in params
    );
  }

  public async execute(context: ModifierContext, params: DynamicDuckingParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.audioDucking = {
      controlTrackId: params.controlTrackId,
      attenuationDb: params.attenuationDb,
      attackMs: params.attackMs ?? 20,
      holdMs: params.holdMs ?? 250,
      releaseMs: params.releaseMs ?? 500,
      active: true,
    };
  }

  /**
   * Modulates PCM stream by attenuation factor when active
   */
  public processAudioStream(
    ctx: AudioProcessContext,
    buffer: Float32Array,
    params: DynamicDuckingParams
  ): void {
    // Convert attenuation dB to linear gain factor: 10^(dB/20)
    // E.g. -16dB => ~0.158
    const gain = Math.pow(10, params.attenuationDb / 20);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] *= gain;
    }
  }
}

