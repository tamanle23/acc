import type {
  ModifierPlugin,
  ModifierContext,
  ClipRenderContext,
  StreamRenderContext,
  MasterCompositeContext,
} from '../ModifierPluginRegistry';
import {
  evaluateSequenceMotion,
  type InterpolatedTransformState,
} from '../../renderer/preview/DeterministicMotionEvaluator';

export interface TransformModifierParams {
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
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
  public readonly targetScope = 'both';
  public readonly targetPhase = 2;

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
    const { ctx: canvasCtx, width, height, sequence, localFrame } = ctx;
    const fps = (sequence as any).fps || 30;
    const localSec = Math.max(0, localFrame / fps);
    const durationSec = Math.max(0.01, (sequence.durationFrames || 1) / fps);

    const motion = evaluateSequenceMotion(params, localSec, durationSec);

    // Position viewport matrix centered at origin [width / 2, height / 2] + offset
    canvasCtx.translate(width * 0.5 + motion.x, height * 0.5 + motion.y);

    if (motion.rotation !== 0) {
      canvasCtx.rotate((motion.rotation * Math.PI) / 180);
    }

    if (motion.scale !== 1.0) {
      canvasCtx.scale(motion.scale, motion.scale);
    }

    canvasCtx.globalAlpha = Math.max(0, Math.min(1, motion.opacity));
  }

  /**
   * Phase 3 / Phase 4: Track-Level or Master-Level Transformation.
   */
  public renderStreamSpace(ctx: StreamRenderContext, params: TransformModifierParams): void {
    const { ctx: canvasCtx, width, height, frame } = ctx;
    const fps = 30;
    const timeSec = frame / fps;
    const motion = evaluateSequenceMotion(params, timeSec, 10.0);

    canvasCtx.translate(width * 0.5 + motion.x, height * 0.5 + motion.y);
    if (motion.rotation !== 0) {
      canvasCtx.rotate((motion.rotation * Math.PI) / 180);
    }
    if (motion.scale !== 1.0) {
      canvasCtx.scale(motion.scale, motion.scale);
    }
    canvasCtx.globalAlpha = Math.max(0, Math.min(1, motion.opacity));
  }

  public renderMasterComposite(ctx: MasterCompositeContext, params: TransformModifierParams): void {
    const { ctx: canvasCtx, width, height, frame } = ctx;
    const fps = 30;
    const timeSec = frame / fps;
    const motion = evaluateSequenceMotion(params, timeSec, 10.0);

    canvasCtx.translate(width * 0.5 + motion.x, height * 0.5 + motion.y);
    if (motion.rotation !== 0) {
      canvasCtx.rotate((motion.rotation * Math.PI) / 180);
    }
    if (motion.scale !== 1.0) {
      canvasCtx.scale(motion.scale, motion.scale);
    }
    canvasCtx.globalAlpha = Math.max(0, Math.min(1, motion.opacity));
  }
}
