/**
 * Pure closed-form deterministic easing curves matching standard GSAP curves.
 * Eliminates DOM and external bundle dependencies for deterministic SSR/preview math.
 */
export type EasingType =
  | 'linear'
  | 'power1.out'
  | 'power1.in'
  | 'power2.out'
  | 'power2.in'
  | 'power2.inOut'
  | 'back.out'
  | 'back.in'
  | 'bounce.out'
  | 'sine.inOut';

export function evaluateEase(ease: EasingType | string, t: number): number {
  const p = Math.max(0, Math.min(1, t));

  switch (ease) {
    case 'power1.out':
      return 1 - Math.pow(1 - p, 2);
    case 'power1.in':
      return p * p;
    case 'power2.out':
      return 1 - Math.pow(1 - p, 3);
    case 'power2.in':
      return p * p * p;
    case 'power2.inOut':
      return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    case 'back.out': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    }
    case 'back.in': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return c3 * p * p * p - c1 * p * p;
    }
    case 'bounce.out': {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (p < 1 / d1) {
        return n1 * p * p;
      } else if (p < 2 / d1) {
        const p2 = p - 1.5 / d1;
        return n1 * p2 * p2 + 0.75;
      } else if (p < 2.5 / d1) {
        const p2 = p - 2.25 / d1;
        return n1 * p2 * p2 + 0.9375;
      } else {
        const p2 = p - 2.625 / d1;
        return n1 * p2 * p2 + 0.984375;
      }
    }
    case 'sine.inOut':
      return -(Math.cos(Math.PI * p) - 1) / 2;
    case 'linear':
    default:
      return p;
  }
}

export interface InterpolatedTransformState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

/**
 * Evaluates a 3-stage lifecycle motion state (intro, steady, outro)
 * purely functionally with zero accumulated memory or wall-clock drift.
 */
export function evaluateSequenceMotion(
  transformParams: Record<string, any> | undefined,
  localSec: number,
  durationSec: number
): InterpolatedTransformState {
  const tp = transformParams || {};
  const targetX = Number.isFinite(tp.x) ? tp.x : 0;
  const targetY = Number.isFinite(tp.y) ? tp.y : 0;
  const targetScale = Number.isFinite(tp.scale) && tp.scale > 0 ? tp.scale : 1.0;
  const targetRot = Number.isFinite(tp.rotation) ? tp.rotation : 0;
  const baseEase = tp.ease || 'power2.out';

  const anim = tp.animation;
  const preset = anim?.preset;

  const introDur = Math.min(durationSec * 0.45, anim?.intro?.durationSec ?? 0.4);
  const introEase = anim?.intro?.ease ?? baseEase;
  const outroDur = Math.min(durationSec * 0.35, anim?.outro?.durationSec ?? 0.3);
  const outroEase = anim?.outro?.ease ?? 'power2.in';
  const steadyType = anim?.steady?.type ?? (preset === 'drift' ? 'drift' : 'hold');

  let initialX = targetX;
  let initialY = targetY;
  let initialScale = targetScale;
  let initialRot = targetRot;
  let initialOpacity = 0;

  if (preset === 'pop_in') {
    initialScale = targetScale * 0.2;
  } else if (preset === 'slide_left') {
    initialX = targetX - 350;
  } else if (preset === 'bounce') {
    initialY = targetY - 200;
    initialScale = targetScale * 0.6;
  } else if (preset === 'overshoot') {
    initialScale = targetScale * 0.3;
  } else if (preset === 'drift') {
    initialScale = targetScale * 0.94;
    initialX = targetX - 40;
  } else {
    initialScale = targetScale * 0.85;
  }

  // 1. Intro Stage
  if (localSec < introDur && introDur > 0) {
    const progress = evaluateEase(introEase, localSec / introDur);
    return {
      x: initialX + (targetX - initialX) * progress,
      y: initialY + (targetY - initialY) * progress,
      scale: initialScale + (targetScale - initialScale) * progress,
      rotation: initialRot + (targetRot - initialRot) * progress,
      opacity: progress,
    };
  }

  // 3. Outro Stage
  const outroStart = durationSec - outroDur;
  if (localSec >= outroStart && outroDur > 0) {
    const outroProgress = evaluateEase(outroEase, (localSec - outroStart) / outroDur);
    let exitScale = targetScale * 0.8;
    let exitX = targetX;
    let exitY = targetY;

    if (preset === 'slide_left') {
      exitX = targetX + 350;
    } else if (preset === 'bounce') {
      exitY = targetY + 150;
    }

    return {
      x: targetX + (exitX - targetX) * outroProgress,
      y: targetY + (exitY - targetY) * outroProgress,
      scale: targetScale + (exitScale - targetScale) * outroProgress,
      rotation: targetRot,
      opacity: 1 - outroProgress,
    };
  }

  // 2. Steady Stage
  if (steadyType === 'drift') {
    const steadyDur = Math.max(0.01, durationSec - introDur - outroDur);
    const steadyProgress = (localSec - introDur) / steadyDur;
    return {
      x: targetX + 15 * steadyProgress,
      y: targetY,
      scale: targetScale * (1.0 + 0.05 * steadyProgress),
      rotation: targetRot,
      opacity: 1.0,
    };
  }

  return {
    x: targetX,
    y: targetY,
    scale: targetScale,
    rotation: targetRot,
    opacity: 1.0,
  };
}
