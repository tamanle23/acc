import type { ModifierPlugin, ModifierContext, AudioProcessContext } from '../ModifierPluginRegistry';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';

export interface DynamicDuckingParams {
  controlTrackId?: string;
  attenuationDb?: number;
  duckVolume?: number;
  attackMs?: number;
  holdMs?: number;
  releaseMs?: number;
  targetBus?: string;
  stereoPan?: number;
}

/**
 * DynamicDuckingPlugin:
 * Bridges audio sidechain compression into an IR audio modifier (`sfx/dynamic_ducking`).
 * Phase 3: Track-Level Execution (Stream Space).
 */
export class DynamicDuckingPlugin implements ModifierPlugin<DynamicDuckingParams> {
  public readonly type = 'sfx/dynamic_ducking';
  public readonly targetScope: ModifierTargetScope = 'sequence';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['audio'];
  public readonly targetPhase = 3;
  public readonly schema = {
    fields: {
      duckVolume: {
        key: 'duckVolume',
        label: 'Ducking Attenuation Ratio',
        type: 'number' as const,
        min: 0.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.25,
      },
      attackMs: {
        key: 'attackMs',
        label: 'Attack Envelope',
        type: 'number' as const,
        min: 10,
        max: 1000,
        step: 10,
        defaultValue: 150,
        unit: 'ms',
      },
      releaseMs: {
        key: 'releaseMs',
        label: 'Release Envelope',
        type: 'number' as const,
        min: 50,
        max: 2000,
        step: 25,
        defaultValue: 300,
        unit: 'ms',
      },
      targetBus: {
        key: 'targetBus',
        label: 'Target Audio Bus ID',
        type: 'string' as const,
        defaultValue: 'track-a3',
      },
    },
  };

  public validate(params: unknown): params is DynamicDuckingParams {
    return Boolean(
      params &&
        typeof params === 'object' &&
        ('controlTrackId' in params || 'attenuationDb' in params || 'duckVolume' in params)
    );
  }

  public async execute(context: ModifierContext, params: DynamicDuckingParams): Promise<void> {
    if (!context.state) context.state = {};
    const attenuation = typeof params.attenuationDb === 'number'
      ? params.attenuationDb
      : typeof params.duckVolume === 'number' && params.duckVolume > 1e-4
      ? 20 * Math.log10(params.duckVolume)
      : -18;

    context.state.audioDucking = {
      controlTrackId: params.controlTrackId,
      attenuationDb: attenuation,
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
    _ctx: AudioProcessContext,
    buffer: Float32Array,
    params: DynamicDuckingParams
  ): void {
    const gain = typeof params.attenuationDb === 'number'
      ? Math.pow(10, params.attenuationDb / 20)
      : typeof params.duckVolume === 'number'
      ? params.duckVolume
      : 1.0;

    if (isNaN(gain) || Math.abs(gain - 1.0) < 1e-4) return;

    for (let i = 0; i < buffer.length; i++) {
      buffer[i] *= gain;
    }
  }
}

