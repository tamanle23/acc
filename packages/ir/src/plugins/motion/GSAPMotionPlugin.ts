import type {
  ModifierPlugin,
  ModifierContext,
  ClipRenderContext,
  StreamRenderContext,
} from '../ModifierPluginRegistry';
import {
  evaluateSequenceMotion,
  type InterpolatedTransformState,
} from '../../renderer/preview/DeterministicMotionEvaluator';

export interface GSAPMotionPluginParams {
  preset?: 'none' | 'pop_in' | 'slide_left' | 'bounce' | 'overshoot' | 'drift';
  ease?: string;
  intro?: { durationSec?: number; ease?: string };
  steady?: { type?: 'hold' | 'drift' | 'pulse'; intensity?: number };
  outro?: { durationSec?: number; ease?: string };
  target?: 'sequence' | 'track' | 'global';
  [key: string]: any;
}

/**
 * GSAPMotionPlugin:
 * First-class modifier plugin in ModifierPluginRegistry ('motion/gsap').
 * Manages deterministic GSAP timeline lifecycles (intro, steady, outro) and parametric easing curves.
 * Target Scope: 'both' (Sequence Clip Space or Global/Track Stream Space).
 * Target Phase: 2 (Clip-Space Sequence Evaluation).
 *
 * Adheres strictly to:
 * - DETERMINISTIC-HANDSHAKE-BACKPRESSURE: Pure closed-form functions of frame integer t.
 * - ZERO-ALLOC-FRAME-LOOP: Reusable matrix evaluation without per-frame memory churn.
 */
export class GSAPMotionPlugin implements ModifierPlugin<GSAPMotionPluginParams> {
  public readonly targetScope = 'both';
  public readonly targetPhase = 2;

  constructor(public readonly type: string = 'motion/gsap') {}

  public readonly schema = {
    displayName: 'GSAP Motion & Lifecycle',
    category: 'motion' as const,
    fields: {
      preset: {
        key: 'preset',
        label: 'Motion Preset',
        type: 'select' as const,
        defaultValue: 'pop_in',
        options: [
          { label: 'Static (No Motion)', value: 'none' },
          { label: 'Pop In (Elastic Zoom)', value: 'pop_in' },
          { label: 'Slide In (Smooth Pan)', value: 'slide_left' },
          { label: 'Bounce (Physical Drop)', value: 'bounce' },
          { label: 'Overshoot (Punchy Snap)', value: 'overshoot' },
          { label: 'Drift (Gentle Float)', value: 'drift' },
        ],
      },
      introDuration: {
        key: 'introDuration',
        label: 'Intro Duration',
        type: 'number' as const,
        min: 0.1,
        max: 2.5,
        step: 0.05,
        defaultValue: 0.4,
        unit: 's',
      },
      outroDuration: {
        key: 'outroDuration',
        label: 'Outro Duration',
        type: 'number' as const,
        min: 0.1,
        max: 2.0,
        step: 0.05,
        defaultValue: 0.3,
        unit: 's',
      },
      ease: {
        key: 'ease',
        label: 'GSAP Easing Curve',
        type: 'curve' as const,
        defaultValue: 'power2.out',
      },
    },
  };

  public validate(params: unknown): params is GSAPMotionPluginParams {
    return Boolean(params && typeof params === 'object');
  }

  public execute(context: ModifierContext, params: GSAPMotionPluginParams): void {
    if (!context.state) context.state = {};
    context.state.gsapMotion = params;
  }

  public evaluateMotion(
    params: GSAPMotionPluginParams | undefined,
    localSec: number,
    durationSec: number
  ): InterpolatedTransformState {
    const transformLike = {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      ease: params?.ease || 'power2.out',
      animation: {
        preset: params?.preset === 'none' ? undefined : params?.preset,
        intro: {
          durationSec: params?.introDuration ?? params?.intro?.durationSec ?? 0.4,
          ease: params?.intro?.ease ?? params?.ease ?? 'power2.out',
        },
        steady: params?.steady || { type: 'hold' },
        outro: {
          durationSec: params?.outroDuration ?? params?.outro?.durationSec ?? 0.3,
          ease: params?.outro?.ease ?? 'power2.in',
        },
      },
    };
    return evaluateSequenceMotion(transformLike, localSec, durationSec);
  }

  public evaluateTransformAtTime(
    modifier: { params?: GSAPMotionPluginParams },
    localSec: number,
    durationSec: number
  ): InterpolatedTransformState {
    return this.evaluateMotion(modifier.params, localSec, durationSec);
  }

  public renderClipSpace(ctx: ClipRenderContext, params: GSAPMotionPluginParams): void {
    if (params.target && params.target !== 'sequence') return;

    const { ctx: canvasCtx, width, height, sequence, localFrame } = ctx;
    const fps = (sequence as any).fps || 30;
    const localSec = Math.max(0, localFrame / fps);
    const durationSec = Math.max(0.01, (sequence.durationFrames || 1) / fps);

    const motion = this.evaluateMotion(params, localSec, durationSec);

    if (motion.opacity <= 0.001) {
      canvasCtx.globalAlpha = 0;
      return;
    }

    const centerX = width * 0.5;
    const centerY = height * 0.5;

    canvasCtx.translate(centerX + motion.x, centerY + motion.y);
    if (motion.rotation !== 0) {
      canvasCtx.rotate((motion.rotation * Math.PI) / 180);
    }
    if (motion.scale !== 1.0) {
      canvasCtx.scale(motion.scale, motion.scale);
    }
    canvasCtx.translate(-centerX, -centerY);

    if (motion.opacity < 1.0) {
      canvasCtx.globalAlpha *= motion.opacity;
    }
  }

  public renderStreamSpace(ctx: StreamRenderContext, params: GSAPMotionPluginParams): void {
    if (params.target && params.target !== 'track') return;

    const { ctx: canvasCtx, width, height, frame, track } = ctx;
    const fps = 30;
    const totalFrames = (track as any).totalDurationFrames || 300;
    const timeSec = frame / fps;
    const durationSec = Math.max(0.01, totalFrames / fps);

    const motion = this.evaluateMotion(params, timeSec, durationSec);

    const centerX = width * 0.5;
    const centerY = height * 0.5;

    canvasCtx.translate(centerX + motion.x, centerY + motion.y);
    if (motion.rotation !== 0) {
      canvasCtx.rotate((motion.rotation * Math.PI) / 180);
    }
    if (motion.scale !== 1.0) {
      canvasCtx.scale(motion.scale, motion.scale);
    }
    canvasCtx.translate(-centerX, -centerY);

    if (motion.opacity < 1.0) {
      canvasCtx.globalAlpha *= motion.opacity;
    }
  }
}
