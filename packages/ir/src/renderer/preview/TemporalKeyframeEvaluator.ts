import { parseCubicBezier, solveCubicBezier } from './BezierMath';
import type { TemporalCurve } from '../../types/modifiers';

/**
 * Standard CSS & NLE Easing Presets mapped to cubic-bezier parameters [x1, y1, x2, y2].
 */
const STANDARD_EASE_CURVES: Record<string, [number, number, number, number]> = {
  linear: [0.0, 0.0, 1.0, 1.0],
  'ease-in': [0.42, 0.0, 1.0, 1.0],
  'ease-out': [0.0, 0.0, 0.58, 1.0],
  'ease-in-out': [0.42, 0.0, 0.58, 1.0],
  ease: [0.25, 0.1, 0.25, 1.0],
};

/**
 * Evaluates progress t in [0, 1] through an easing string (named preset or cubic-bezier(...)).
 */
export function evaluateEasingProgress(t: number, ease?: string): number {
  const clampedT = Math.max(0, Math.min(1, t));
  if (!ease || ease === 'linear') return clampedT;

  const standard = STANDARD_EASE_CURVES[ease.toLowerCase()];
  if (standard) {
    return solveCubicBezier(standard[0], standard[1], standard[2], standard[3], clampedT);
  }

  const parsed = parseCubicBezier(ease);
  if (parsed) {
    return solveCubicBezier(parsed[0], parsed[1], parsed[2], parsed[3], clampedT);
  }

  return clampedT;
}

export interface KeyframePoint<T = number> {
  timeSec: number;
  value: T;
  ease?: string;
}

/**
 * TemporalKeyframeEvaluator:
 * Deterministic piecewise interpolator for keyframed curves.
 * Complies with ZERO-ALLOC-FRAME-LOOP and DETERMINISTIC-HANDSHAKE-BACKPRESSURE.
 */
export class TemporalKeyframeEvaluator {
  /**
   * Evaluates a numeric TemporalCurve or scalar value at timeSec.
   */
  public static evaluateNumeric(
    curveOrScalar: number | TemporalCurve<number> | undefined,
    timeSec: number,
    defaultValue: number = 0
  ): number {
    if (curveOrScalar === undefined || curveOrScalar === null) {
      return defaultValue;
    }

    if (typeof curveOrScalar === 'number') {
      return curveOrScalar;
    }

    // 1. Evaluate keyframe sequence if defined
    if (curveOrScalar.keyframes && curveOrScalar.keyframes.length > 0) {
      return this.interpolateKeyframes(curveOrScalar.keyframes, timeSec);
    }

    // 2. Evaluate intro/steady/outro lifecycle if keyframes are not present
    let currentVal = defaultValue;
    const intro = curveOrScalar.intro;
    const outro = curveOrScalar.outro;

    if (intro && timeSec < intro.durationSec) {
      const t = timeSec / Math.max(0.001, intro.durationSec);
      const easedT = evaluateEasingProgress(t, intro.ease);
      const target = intro.to !== undefined ? intro.to : defaultValue;
      return intro.from + (target - intro.from) * easedT;
    }

    return currentVal;
  }

  /**
   * Interpolates an array of keyframes at timeSec with boundary clamping and segment easing.
   */
  public static interpolateKeyframes(
    keyframes: Array<{ timeSec: number; value: number; ease?: string }>,
    timeSec: number
  ): number {
    if (!keyframes || keyframes.length === 0) return 0;
    if (keyframes.length === 1) return keyframes[0].value;

    // Boundary conditions
    if (timeSec <= keyframes[0].timeSec) {
      return keyframes[0].value;
    }

    const lastIdx = keyframes.length - 1;
    if (timeSec >= keyframes[lastIdx].timeSec) {
      return keyframes[lastIdx].value;
    }

    // Binary search or linear scan for segment [k_i, k_{i+1}]
    for (let i = 0; i < lastIdx; i++) {
      const k0 = keyframes[i];
      const k1 = keyframes[i + 1];

      if (timeSec >= k0.timeSec && timeSec <= k1.timeSec) {
        const span = k1.timeSec - k0.timeSec;
        if (span <= 1e-6) return k1.value;

        const normalizedT = (timeSec - k0.timeSec) / span;
        const easedT = evaluateEasingProgress(normalizedT, k0.ease || 'ease-in-out');

        return k0.value + (k1.value - k0.value) * easedT;
      }
    }

    return keyframes[lastIdx].value;
  }
}
