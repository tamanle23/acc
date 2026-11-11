import type { ModifierPlugin, ModifierContext, ClipRenderContext } from '../ModifierPluginRegistry';
import type { SequenceType, TrackType } from '../../types/VideoIR';

export type CrossfadeCurveMode = 'linear' | 'equal_power';

export interface TransitionCrossfadeParams {
  durationFrames: number;
  overlapTarget?: string;
  mode?: CrossfadeCurveMode;
}

/**
 * Calculates dual-channel crossfade curves.
 * - 'linear': Standard linear interpolation (alphaIn = t, alphaOut = 1 - t).
 * - 'equal_power': Constant acoustic/optical power quarter-sine interpolation
 *   (alphaIn = sin(pi/2 * t), alphaOut = cos(pi/2 * t) => sin^2 + cos^2 === 1.0).
 */
export function calculateCrossfadeAlpha(
  rawProgress: number,
  mode: CrossfadeCurveMode = 'linear'
): { alphaIn: number; alphaOut: number } {
  const t = Math.max(0, Math.min(1, rawProgress));
  if (mode === 'equal_power') {
    const theta = (Math.PI / 2) * t;
    return {
      alphaIn: Math.sin(theta),
      alphaOut: Math.cos(theta),
    };
  }
  return {
    alphaIn: t,
    alphaOut: 1 - t,
  };
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
      mode: {
        key: 'mode',
        label: 'Crossfade Curve Mode',
        type: 'select' as const,
        defaultValue: 'linear',
        options: [
          { label: 'Linear (Standard Video Dissolve)', value: 'linear' },
          { label: 'Equal Power (Acoustic / Additive Power Preserving)', value: 'equal_power' },
        ],
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
      mode: params.mode || 'linear',
    };
  }

  public renderClipSpace(ctx: ClipRenderContext, params: TransitionCrossfadeParams): void {
    const { ctx: canvasCtx, localFrame } = ctx;
    const dur = params.durationFrames;

    // Crossfade: incoming sequence smoothly fades in over the outgoing sequence
    if (localFrame < dur) {
      const progress = dur > 0 ? localFrame / dur : 1;
      const { alphaIn } = calculateCrossfadeAlpha(progress, params.mode);
      canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * alphaIn));
    }
  }
}

