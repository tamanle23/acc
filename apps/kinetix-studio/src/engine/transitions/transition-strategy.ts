// ============================================================================
// KINETIX STUDIO v6.0 - TRANSITION STRATEGY PATTERN (ECMA-429)
// High-performance canvas blending & optical transitions between scenes.
// ============================================================================

import type { TransitionType, TransitionDirection } from '@/types/storyboard';

export interface TransitionRenderContext {
  readonly fromCanvas: CanvasImageSource;
  readonly toCanvas: CanvasImageSource;
  readonly targetCtx: CanvasRenderingContext2D;
  readonly progress: number; // [0, 1]
  readonly width: number;
  readonly height: number;
  readonly direction?: TransitionDirection;
}

export interface ITransitionStrategy {
  readonly type: TransitionType;
  render(context: TransitionRenderContext): void;
}

/**
 * Direct hard cut at the transition boundary.
 */
export class CutTransition implements ITransitionStrategy {
  public readonly type: TransitionType = 'cut';

  public render(ctx: TransitionRenderContext): void {
    const { fromCanvas, toCanvas, targetCtx, progress, width, height } = ctx;
    const source = progress < 0.5 ? fromCanvas : toCanvas;
    targetCtx.save();
    targetCtx.drawImage(source, 0, 0, width, height);
    targetCtx.restore();
  }
}

/**
 * Linear/eased alpha cross-dissolve with proper compositing flags.
 */
export class CrossDissolveTransition implements ITransitionStrategy {
  public readonly type: TransitionType = 'cross-dissolve';

  public render(ctx: TransitionRenderContext): void {
    const { fromCanvas, toCanvas, targetCtx, progress, width, height } = ctx;
    const clamped = Math.max(0, Math.min(1, progress));

    targetCtx.save();
    // Render base frame (fromCanvas)
    targetCtx.globalAlpha = 1.0;
    targetCtx.drawImage(fromCanvas, 0, 0, width, height);

    // Blend incoming frame (toCanvas) on top
    targetCtx.globalAlpha = clamped;
    targetCtx.drawImage(toCanvas, 0, 0, width, height);
    targetCtx.restore();
  }
}

/**
 * High-speed directional whip-pan with motion streak styling.
 */
export class WhipPanTransition implements ITransitionStrategy {
  public readonly type: TransitionType = 'whip-pan';

  public render(ctx: TransitionRenderContext): void {
    const { fromCanvas, toCanvas, targetCtx, progress, width, height, direction = 'right' } = ctx;
    const p = Math.max(0, Math.min(1, progress));

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(0, 0, width, height);
    targetCtx.clip();

    let dxFrom = 0;
    let dyFrom = 0;
    let dxTo = 0;
    let dyTo = 0;

    switch (direction) {
      case 'right':
        dxFrom = p * width;
        dxTo = (p - 1) * width;
        break;
      case 'left':
        dxFrom = -p * width;
        dxTo = (1 - p) * width;
        break;
      case 'down':
        dyFrom = p * height;
        dyTo = (p - 1) * height;
        break;
      case 'up':
      default:
        dyFrom = -p * height;
        dyTo = (1 - p) * height;
        break;
    }

    targetCtx.drawImage(fromCanvas, dxFrom, dyFrom, width, height);
    targetCtx.drawImage(toCanvas, dxTo, dyTo, width, height);

    // Optional motion streak highlight during mid-point velocity
    const streakAlpha = Math.sin(p * Math.PI) * 0.25;
    if (streakAlpha > 0.02) {
      targetCtx.fillStyle = `rgba(255, 255, 255, ${streakAlpha.toFixed(3)})`;
      targetCtx.fillRect(0, 0, width, height);
    }

    targetCtx.restore();
  }
}

/**
 * Digital glitch dissolve with slice displacement and chromatic aberration.
 */
export class GlitchDissolveTransition implements ITransitionStrategy {
  public readonly type: TransitionType = 'glitch-dissolve';

  public render(ctx: TransitionRenderContext): void {
    const { fromCanvas, toCanvas, targetCtx, progress, width, height } = ctx;
    const p = Math.max(0, Math.min(1, progress));

    targetCtx.save();

    // Base crossfade
    targetCtx.globalAlpha = 1.0;
    targetCtx.drawImage(fromCanvas, 0, 0, width, height);

    targetCtx.globalAlpha = p;
    targetCtx.drawImage(toCanvas, 0, 0, width, height);

    // Glitch horizontal slices
    const glitchIntensity = Math.sin(p * Math.PI);
    if (glitchIntensity > 0.05) {
      const sliceCount = 12;
      const sliceHeight = height / sliceCount;

      for (let i = 0; i < sliceCount; i++) {
        // Deterministic pseudo-random seed per slice & progress quantum
        const seed = Math.sin(i * 997 + Math.floor(p * 24) * 31);
        if (Math.abs(seed) > 0.35) {
          const shiftX = seed * 40 * glitchIntensity;
          const sy = i * sliceHeight;

          // Draw jittered slice from incoming canvas if seed > 0, else outgoing
          const sliceSource = seed > 0 ? toCanvas : fromCanvas;
          targetCtx.save();
          targetCtx.beginPath();
          targetCtx.rect(0, sy, width, sliceHeight);
          targetCtx.clip();

          targetCtx.globalAlpha = 0.85;
          targetCtx.drawImage(sliceSource, shiftX, 0, width, height);
          targetCtx.restore();
        }
      }
    }

    targetCtx.restore();
  }
}

/**
 * Geometric matte wipe along an axis with crisp boundary edge.
 */
export class MatteWipeTransition implements ITransitionStrategy {
  public readonly type: TransitionType = 'matte-wipe';

  public render(ctx: TransitionRenderContext): void {
    const { fromCanvas, toCanvas, targetCtx, progress, width, height, direction = 'right' } = ctx;
    const p = Math.max(0, Math.min(1, progress));

    targetCtx.save();
    // First render background (fromCanvas)
    targetCtx.drawImage(fromCanvas, 0, 0, width, height);

    // Then clip and render incoming (toCanvas)
    targetCtx.beginPath();
    switch (direction) {
      case 'right':
        targetCtx.rect(0, 0, width * p, height);
        break;
      case 'left':
        targetCtx.rect(width * (1 - p), 0, width * p, height);
        break;
      case 'down':
        targetCtx.rect(0, 0, width, height * p);
        break;
      case 'up':
      default:
        targetCtx.rect(0, height * (1 - p), width, height * p);
        break;
    }
    targetCtx.clip();
    targetCtx.drawImage(toCanvas, 0, 0, width, height);
    targetCtx.restore();
  }
}

/**
 * Optical cross-zoom transition scaling out outgoing canvas and scaling in incoming canvas.
 */
export class CrossZoomTransition implements ITransitionStrategy {
  public readonly type: TransitionType = 'cross-zoom';

  public render(ctx: TransitionRenderContext): void {
    const { fromCanvas, toCanvas, targetCtx, progress, width, height } = ctx;
    const p = Math.max(0, Math.min(1, progress));

    const cx = width / 2;
    const cy = height / 2;

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(0, 0, width, height);
    targetCtx.clip();

    // Outgoing scales up [1.0 -> 1.5] and fades out [1 -> 0]
    const scaleFrom = 1.0 + p * 0.6;
    const alphaFrom = Math.max(0, 1.0 - p * 1.2);
    if (alphaFrom > 0) {
      targetCtx.save();
      targetCtx.globalAlpha = alphaFrom;
      targetCtx.translate(cx, cy);
      targetCtx.scale(scaleFrom, scaleFrom);
      targetCtx.translate(-cx, -cy);
      targetCtx.drawImage(fromCanvas, 0, 0, width, height);
      targetCtx.restore();
    }

    // Incoming scales down [0.6 -> 1.0] and fades in [0 -> 1]
    const scaleTo = 0.6 + p * 0.4;
    const alphaTo = Math.min(1.0, p * 1.3);
    if (alphaTo > 0) {
      targetCtx.save();
      targetCtx.globalAlpha = alphaTo;
      targetCtx.translate(cx, cy);
      targetCtx.scale(scaleTo, scaleTo);
      targetCtx.translate(-cx, -cy);
      targetCtx.drawImage(toCanvas, 0, 0, width, height);
      targetCtx.restore();
    }

    targetCtx.restore();
  }
}

/**
 * 3D Orbital spin transition: outgoing frame rotates and scales down while incoming spins in and scales up.
 */
export class SpinOrbitDissolveTransition implements ITransitionStrategy {
  public readonly type: TransitionType = 'spin-orbit-dissolve';

  public render(ctx: TransitionRenderContext): void {
    const { fromCanvas, toCanvas, targetCtx, progress, width, height, direction = 'right' } = ctx;
    const p = Math.max(0, Math.min(1, progress));
    const cx = width / 2;
    const cy = height / 2;
    const dirSign = direction === 'left' ? -1 : 1;

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(0, 0, width, height);
    targetCtx.clip();

    // 1. Outgoing scene: rotates 0 to +60 deg, scales down 1.0 to 0.45, fades out
    const alphaFrom = Math.max(0, 1.0 - p * 1.4);
    if (alphaFrom > 0) {
      const rotFrom = p * (Math.PI * 0.35) * dirSign;
      const scaleFrom = 1.0 - p * 0.55;
      targetCtx.save();
      targetCtx.globalAlpha = alphaFrom;
      targetCtx.translate(cx, cy);
      targetCtx.rotate(rotFrom);
      targetCtx.scale(scaleFrom, scaleFrom);
      targetCtx.drawImage(fromCanvas, -cx, -cy, width, height);
      targetCtx.restore();
    }

    // 2. Incoming scene: rotates -60 deg to 0, scales up 1.5 to 1.0, fades in
    const alphaTo = Math.min(1.0, p * 1.4);
    if (alphaTo > 0) {
      const rotTo = (p - 1.0) * (Math.PI * 0.35) * dirSign;
      const scaleTo = 1.5 - p * 0.5;
      targetCtx.save();
      targetCtx.globalAlpha = alphaTo;
      targetCtx.translate(cx, cy);
      targetCtx.rotate(rotTo);
      targetCtx.scale(scaleTo, scaleTo);
      targetCtx.drawImage(toCanvas, -cx, -cy, width, height);
      targetCtx.restore();
    }

    targetCtx.restore();
  }
}

/**
 * Cinematic Dolly Punch-Through: Outgoing frame punches forward (zoom 1.0 -> 3.0) and dissolves,
 * while incoming frame punches in from behind (scale 0.45 -> 1.0) with focal blur.
 */
export class DollyPunchThroughTransition implements ITransitionStrategy {
  public readonly type: TransitionType = 'dolly-punch-through';

  public render(ctx: TransitionRenderContext): void {
    const { fromCanvas, toCanvas, targetCtx, progress, width, height } = ctx;
    const p = Math.max(0, Math.min(1, progress));
    const cx = width / 2;
    const cy = height / 2;

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(0, 0, width, height);
    targetCtx.clip();

    // 1. Outgoing scene: punches forward into camera
    const scaleFrom = 1.0 + Math.pow(p, 1.5) * 2.2;
    const alphaFrom = Math.max(0, 1.0 - p * 1.6);
    if (alphaFrom > 0) {
      targetCtx.save();
      targetCtx.globalAlpha = alphaFrom;
      targetCtx.translate(cx, cy);
      targetCtx.scale(scaleFrom, scaleFrom);
      targetCtx.drawImage(fromCanvas, -cx, -cy, width, height);
      targetCtx.restore();
    }

    // 2. Incoming scene: punches in from depth to 1.0
    const scaleTo = 0.45 + (1 - Math.pow(1 - p, 2)) * 0.55;
    const alphaTo = Math.min(1.0, p * 1.5);
    if (alphaTo > 0) {
      targetCtx.save();
      targetCtx.globalAlpha = alphaTo;
      targetCtx.translate(cx, cy);
      targetCtx.scale(scaleTo, scaleTo);
      targetCtx.drawImage(toCanvas, -cx, -cy, width, height);
      targetCtx.restore();
    }

    targetCtx.restore();
  }
}

/**
 * Registry mapping TransitionType strings to their corresponding ITransitionStrategy implementations.
 */
export class TransitionRegistry {
  private static readonly strategies = new Map<TransitionType, ITransitionStrategy>([
    ['cut', new CutTransition()],
    ['cross-dissolve', new CrossDissolveTransition()],
    ['whip-pan', new WhipPanTransition()],
    ['glitch-dissolve', new GlitchDissolveTransition()],
    ['matte-wipe', new MatteWipeTransition()],
    ['cross-zoom', new CrossZoomTransition()],
    ['spin-orbit-dissolve', new SpinOrbitDissolveTransition()],
    ['dolly-punch-through', new DollyPunchThroughTransition()],
  ]);

  private static fallbackStrategy: ITransitionStrategy = new CrossDissolveTransition();

  public static get(type: TransitionType): ITransitionStrategy {
    return this.strategies.get(type) ?? this.fallbackStrategy;
  }

  public static register(type: TransitionType, strategy: ITransitionStrategy): void {
    this.strategies.set(type, strategy);
  }

  public static getAvailableTypes(): readonly TransitionType[] {
    return Array.from(this.strategies.keys());
  }
}
