import type { ModifierPlugin, ModifierContext, ClipRenderContext } from '../ModifierPluginRegistry';
import type { SequenceType, TrackType } from '../../types/VideoIR';

export interface TransitionCrossfadeParams {
  durationFrames: number;
  overlapTarget?: string;
}

/**
 * TransitionCrossfadePlugin:
 * Implements video/audio crossfade transitions (`transition/crossfade`).
 * Phase 2: Sequence-Level Execution (Clip Space).
 */
export class TransitionCrossfadePlugin implements ModifierPlugin<TransitionCrossfadeParams> {
  public readonly type = 'transition/crossfade';
  public readonly targetScope = 'sequence';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['video', 'image', 'overlay', 'audio'];
  public readonly isUniversal = true;
  public readonly supportedTrackTypes: readonly TrackType[] = ['video', 'audio'];
  public readonly instancePolicy = 'multiple' as const;
  public readonly targetPhase = 2;
  public readonly schema = {
    fields: {
      durationFrames: {
        key: 'durationFrames',
        label: 'Transition Duration',
        type: 'number' as const,
        min: 1,
        max: 120,
        step: 1,
        defaultValue: 15,
        unit: 'f',
      },
      overlapTarget: {
        key: 'overlapTarget',
        label: 'Overlap Target Sequence ID',
        type: 'string' as const,
        defaultValue: '',
      },
    },
  };

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

  public renderClipSpace(ctx: ClipRenderContext, params: TransitionCrossfadeParams): void {
    const { ctx: canvasCtx, localFrame, sequence } = ctx;
    const dur = params.durationFrames;

    // Crossfade: incoming sequence smoothly fades in over the outgoing sequence
    if (params.overlapTarget && localFrame < dur) {
      canvasCtx.globalAlpha = Math.max(0, Math.min(1, localFrame / dur));
    }
  }
}

