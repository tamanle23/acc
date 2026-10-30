import type {
  ModifierPlugin,
  ModifierContext,
  ClipRenderContext,
  StreamRenderContext,
  MasterCompositeContext,
} from '../ModifierPluginRegistry';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType, TrackType } from '../../types/VideoIR';
import {
  evaluateSequenceMotion,
  type InterpolatedTransformState,
} from '../../motion/DeterministicMotionEvaluator';

export interface TransformModifierParams {
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  normX?: number;
  normY?: number;
  anchorPoint?: [number, number];
  target?: 'sequence' | 'track' | 'global';
  ease?: string;
  animation?: {
    preset?: 'pop_in' | 'slide_left' | 'bounce' | 'overshoot' | 'drift';
    intro?: { durationSec?: number; ease?: string };
    steady?: { type?: 'hold' | 'drift' };
    outro?: { durationSec?: number; ease?: string };
  };
  [key: string]: any;
}

/**
 * TransformModifierPlugin:
 * Implements deterministic 2D affine spatial transformations & motion curves ('transform').
 * Target Scope: 'both' (Sequence Clip Space or Global/Track Stream & Master Space).
 * Target Phase: 2 (Clip-Space Sequence Evaluation).
 *
 * Adheres strictly to:
 * - DETERMINISTIC-HANDSHAKE-BACKPRESSURE: Pure closed-form functions of frame integer t.
 * - ZERO-ALLOC-FRAME-LOOP: Reusable state calculations without heap churn.
 */
export class TransformModifierPlugin implements ModifierPlugin<TransformModifierParams> {
  public readonly type = 'transform';
  public readonly targetScope: ModifierTargetScope = 'sequence';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['video', 'image', 'overlay', 'text'];
  public readonly isUniversal = true;
  public readonly supportedTrackTypes: readonly TrackType[] = ['video', 'timed_text'];
  public readonly instancePolicy = 'single' as const;
  public readonly targetPhase = 2;
  public readonly schema = {
    fields: {
      x: {
        key: 'x',
        label: 'Offset X',
        type: 'number' as const,
        min: -960,
        max: 960,
        step: 1,
        defaultValue: 0,
        unit: 'px',
      },
      y: {
        key: 'y',
        label: 'Offset Y',
        type: 'number' as const,
        min: -540,
        max: 540,
        step: 1,
        defaultValue: 0,
        unit: 'px',
      },
      scale: {
        key: 'scale',
        label: 'Uniform Scale',
        type: 'number' as const,
        min: 0.1,
        max: 4.0,
        step: 0.05,
        defaultValue: 1.0,
        unit: 'x',
      },
      rotation: {
        key: 'rotation',
        label: 'Rotation',
        type: 'number' as const,
        min: -180,
        max: 180,
        step: 1,
        defaultValue: 0,
        unit: '°',
      },
      opacity: {
        key: 'opacity',
        label: 'Opacity',
        type: 'number' as const,
        min: 0.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 1.0,
      },
      animation: {
        key: 'animation',
        label: 'Motion Lifecycle Animation',
        type: 'motion_lifecycle' as const,
        defaultValue: {
          preset: 'none',
          intro: { durationSec: 0.4, ease: 'power2.out' },
          outro: { durationSec: 0.3, ease: 'power2.in' },
        },
      },
    },
  };

  public validate(params: unknown): params is TransformModifierParams {
    return Boolean(params && typeof params === 'object');
  }

  public execute(context: ModifierContext, params: TransformModifierParams): void {
    if (!context.state) context.state = {};
    context.state.transform = params;
  }

  /**
   * Evaluates interpolated motion state for arbitrary frame integer t.
   */
  public evaluateMotion(
    params: TransformModifierParams | undefined,
    localSec: number,
    durationSec: number
  ): InterpolatedTransformState {
    return evaluateSequenceMotion(params, localSec, durationSec);
  }

  /**
   * Phase 2: Sequence-Level (Clip Space) Matrix Stacking.
   * Stacks affine coordinate transform: translate -> rotate -> scale -> globalAlpha.
   */
  public renderClipSpace(ctx: ClipRenderContext, params: TransformModifierParams): void {
    if (params.target && params.target !== 'sequence') {
      return;
    }

    const { ctx: canvasCtx, width, height, sequence, localFrame } = ctx;
    const fps = (sequence as any).fps || 30;
    const localSec = Math.max(0, localFrame / fps);
    const durationSec = Math.max(0.01, (sequence.durationFrames || 1) / fps);

    const motion = evaluateSequenceMotion(params, localSec, durationSec);

    if (motion.opacity <= 0.001) {
      canvasCtx.globalAlpha = 0;
      return;
    }

    const anchorNormX = params.anchorPoint?.[0] ?? 0.5;
    const anchorNormY = params.anchorPoint?.[1] ?? 0.5;
    const anchorX = width * anchorNormX;
    const anchorY = height * anchorNormY;

    canvasCtx.translate(anchorX + motion.x, anchorY + motion.y);
    if (motion.rotation !== 0) {
      canvasCtx.rotate((motion.rotation * Math.PI) / 180);
    }
    if (motion.scale !== 1.0) {
      canvasCtx.scale(motion.scale, motion.scale);
    }
    canvasCtx.translate(-anchorX, -anchorY);

    canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * motion.opacity));
  }

  public renderStreamSpace(ctx: StreamRenderContext, params: TransformModifierParams): void {
    if (params.target !== 'track') {
      return;
    }

    const { ctx: canvasCtx, width, height, frame } = ctx;
    const fps = 30;
    const timeSec = frame / fps;
    const motion = evaluateSequenceMotion(params, timeSec, 10.0);

    if (motion.opacity <= 0.001) {
      canvasCtx.globalAlpha = 0;
      return;
    }

    const anchorNormX = params.anchorPoint?.[0] ?? 0.5;
    const anchorNormY = params.anchorPoint?.[1] ?? 0.5;
    const anchorX = width * anchorNormX;
    const anchorY = height * anchorNormY;

    canvasCtx.translate(anchorX + motion.x, anchorY + motion.y);
    if (motion.rotation !== 0) {
      canvasCtx.rotate((motion.rotation * Math.PI) / 180);
    }
    if (motion.scale !== 1.0) {
      canvasCtx.scale(motion.scale, motion.scale);
    }
    canvasCtx.translate(-anchorX, -anchorY);

    canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * motion.opacity));
  }

  public renderMasterComposite(ctx: MasterCompositeContext, params: TransformModifierParams): void {
    if (params.target && params.target !== 'global') {
      return;
    }

    const { ctx: canvasCtx, width, height, frame } = ctx;
    const fps = 30;
    const timeSec = frame / fps;
    const motion = evaluateSequenceMotion(params, timeSec, 10.0);

    if (motion.opacity <= 0.001) {
      canvasCtx.globalAlpha = 0;
      return;
    }

    const anchorNormX = params.anchorPoint?.[0] ?? 0.5;
    const anchorNormY = params.anchorPoint?.[1] ?? 0.5;
    const anchorX = width * anchorNormX;
    const anchorY = height * anchorNormY;

    canvasCtx.translate(anchorX + motion.x, anchorY + motion.y);
    if (motion.rotation !== 0) {
      canvasCtx.rotate((motion.rotation * Math.PI) / 180);
    }
    if (motion.scale !== 1.0) {
      canvasCtx.scale(motion.scale, motion.scale);
    }
    canvasCtx.translate(-anchorX, -anchorY);

    canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * motion.opacity));
  }
}
