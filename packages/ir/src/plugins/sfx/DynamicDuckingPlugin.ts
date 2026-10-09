import type { ModifierPlugin, ModifierContext } from '../ModifierPluginRegistry';

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
 */
export class DynamicDuckingPlugin implements ModifierPlugin<DynamicDuckingParams> {
  public readonly type = 'sfx/dynamic_ducking';
  public readonly targetScope = 'both';

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
}
