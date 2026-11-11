// ============================================================================
// KINETIX STUDIO - CORE DOMAIN: STUDIO-GRADE UNIT BEZIER POLYNOMIAL SOLVER (ECMA-429)
// Evaluates cubic Bézier curves with dual handles using fast Newton-Raphson
// iteration and bisection fallback. Compatible with all WinterTC web runtimes.
// ============================================================================

import type { BezierKnot, TangentMode } from '@/types/motion';

/**
 * Standard cubic Bézier presets for studio-grade motion choreography.
 */
export const BEZIER_PRESETS = {
  linear: [0.0, 0.0, 1.0, 1.0],
  ease: [0.25, 0.1, 0.25, 1.0],
  easeIn: [0.42, 0.0, 1.0, 1.0],
  easeOut: [0.0, 0.0, 0.58, 1.0],
  easeInOut: [0.42, 0.0, 0.58, 1.0],
  gentleSpring: [0.175, 0.885, 0.32, 1.275],
  snappyBounce: [0.68, -0.55, 0.265, 1.55],
  dramaticClimax: [0.85, 0.0, 0.15, 1.0],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type BezierPresetName = keyof typeof BEZIER_PRESETS;
export type BezierCoordinates = readonly [p1x: number, p1y: number, p2x: number, p2y: number];

/**
 * High-performance Unit Bézier curve evaluator.
 * Solves for y given x in [0, 1] using parametric cubic polynomial coefficients.
 */
export class UnitBezier {
  private readonly ax: number;
  private readonly bx: number;
  private readonly cx: number;
  private readonly ay: number;
  private readonly by: number;
  private readonly cy: number;

  public readonly p1x: number;
  public readonly p1y: number;
  public readonly p2x: number;
  public readonly p2y: number;

  constructor(p1x: number, p1y: number, p2x: number, p2y: number) {
    // Clamp control point x values within [0, 1] to guarantee monotonic time progress
    this.p1x = Math.max(0, Math.min(1, p1x));
    this.p1y = p1y;
    this.p2x = Math.max(0, Math.min(1, p2x));
    this.p2y = p2y;

    // Polynomial coefficients for X(t) = ax*t^3 + bx*t^2 + cx*t
    this.cx = 3.0 * this.p1x;
    this.bx = 3.0 * (this.p2x - this.p1x) - this.cx;
    this.ax = 1.0 - this.cx - this.bx;

    // Polynomial coefficients for Y(t) = ay*t^3 + by*t^2 + cy*t
    this.cy = 3.0 * this.p1y;
    this.by = 3.0 * (this.p2y - this.p1y) - this.cy;
    this.ay = 1.0 - this.cy - this.by;
  }

  /**
   * Evaluates X(t)
   */
  public sampleCurveX(t: number): number {
    return ((this.ax * t + this.bx) * t + this.cx) * t;
  }

  /**
   * Evaluates Y(t)
   */
  public sampleCurveY(t: number): number {
    return ((this.ay * t + this.by) * t + this.cy) * t;
  }

  /**
   * Evaluates dX/dt
   */
  public sampleCurveDerivativeX(t: number): number {
    return (3.0 * this.ax * t + 2.0 * this.bx) * t + this.cx;
  }

  /**
   * Evaluates dY/dt
   */
  public sampleCurveDerivativeY(t: number): number {
    return (3.0 * this.ay * t + 2.0 * this.by) * t + this.cy;
  }

  /**
   * Solves for parameter t given x progress in [0, 1].
   * Uses Newton-Raphson iteration with bisection search fallback.
   */
  public solveCurveX(x: number, epsilon = 1e-6): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // Fast Newton-Raphson iteration
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xEst = this.sampleCurveX(t) - x;
      if (Math.abs(xEst) < epsilon) {
        return t;
      }
      const dX = this.sampleCurveDerivativeX(t);
      if (Math.abs(dX) < 1e-6) {
        break; // Zero derivative, fall through to bisection
      }
      t -= xEst / dX;
      // If t escapes unit interval, bail to bisection
      if (t < 0 || t > 1) {
        break;
      }
    }

    // Robust Bisection search fallback
    let t0 = 0.0;
    let t1 = 1.0;
    t = x;

    while (t0 < t1) {
      const xEst = this.sampleCurveX(t);
      if (Math.abs(xEst - x) < epsilon) {
        return t;
      }
      if (x > xEst) {
        t0 = t;
      } else {
        t1 = t;
      }
      t = (t1 - t0) * 0.5 + t0;
      if (t1 - t0 < epsilon) {
        break;
      }
    }

    return t;
  }

  /**
   * Evaluates y given x progress in [0, 1].
   */
  public solve(x: number, epsilon = 1e-6): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const t = this.solveCurveX(x, epsilon);
    return this.sampleCurveY(t);
  }

  /**
   * Calculates instantaneous velocity (dy/dx = (dy/dt) / (dx/dt)).
   */
  public getVelocity(x: number, epsilon = 1e-6): number {
    if (x <= 0 || x >= 1) return 0;
    const t = this.solveCurveX(x, epsilon);
    const dx = this.sampleCurveDerivativeX(t);
    if (Math.abs(dx) < 1e-6) return 0;
    const dy = this.sampleCurveDerivativeY(t);
    return dy / dx;
  }
}

/**
 * Creates an easing function from a preset name or 4-element coordinate tuple.
 */
export function createBezierEasing(
  presetOrCoords: BezierPresetName | BezierCoordinates
): (t: number) => number {
  const coords: BezierCoordinates =
    typeof presetOrCoords === 'string'
      ? (BEZIER_PRESETS[presetOrCoords] ?? BEZIER_PRESETS.ease)
      : presetOrCoords;

  const [p1x, p1y, p2x, p2y] = coords;
  const solver = new UnitBezier(p1x, p1y, p2x, p2y);

  return (t: number) => solver.solve(t);
}

/**
 * Resolves coordinates for a known preset.
 */
export function getBezierPresetCoordinates(preset: BezierPresetName): BezierCoordinates {
  return BEZIER_PRESETS[preset];
}

/**
 * Calculates SVG pixel coordinates for a knot's in/out tangent control points.
 */
export function computeKnotTangentPoints(
  knot: BezierKnot,
  toSvgX: (t: number) => number,
  toSvgY: (v: number) => number,
  fallbackDt = 0.08
): { inX: number; inY: number; outX: number; outY: number; knotX: number; knotY: number } {
  const knotX = toSvgX(knot.t);
  const knotY = toSvgY(knot.val);

  const dtIn = knot.cpIn ? knot.cpIn[0] : -fallbackDt;
  const dvIn = knot.cpIn ? knot.cpIn[1] : 0;
  const dtOut = knot.cpOut ? knot.cpOut[0] : fallbackDt;
  const dvOut = knot.cpOut ? knot.cpOut[1] : 0;

  return {
    knotX,
    knotY,
    inX: toSvgX(knot.t + dtIn),
    inY: toSvgY(knot.val + dvIn),
    outX: toSvgX(knot.t + dtOut),
    outY: toSvgY(knot.val + dvOut),
  };
}

/**
 * Enforces horizontal monotonicity so tangent handles never cause time reversals.
 */
export function clampKnotTangents(
  knot: BezierKnot,
  dtPrev = 0.5,
  dtNext = 0.5
): void {
  if (knot.cpIn) {
    // cpIn must be backward in time: [-dtPrev, 0]
    const clampedDt = Math.max(-Math.abs(dtPrev), Math.min(0, knot.cpIn[0]));
    knot.cpIn = [clampedDt, knot.cpIn[1]];
  }
  if (knot.cpOut) {
    // cpOut must be forward in time: [0, dtNext]
    const clampedDt = Math.max(0, Math.min(Math.abs(dtNext), knot.cpOut[0]));
    knot.cpOut = [clampedDt, knot.cpOut[1]];
  }
}

/**
 * Aligns tangent handles according to the knot's TangentMode.
 */
export function alignTangents(
  knot: BezierKnot,
  activeHandle: 'cpIn' | 'cpOut',
  mode: TangentMode = knot.tangentMode ?? 'smooth'
): void {
  knot.tangentMode = mode;

  if (mode === 'broken') {
    return;
  }

  if (mode === 'flat') {
    if (knot.cpIn) knot.cpIn = [knot.cpIn[0], 0];
    if (knot.cpOut) knot.cpOut = [knot.cpOut[0], 0];
    return;
  }

  // Smooth mode: collinear opposite angle
  if (activeHandle === 'cpIn' && knot.cpIn && knot.cpOut) {
    const lenIn = Math.hypot(knot.cpIn[0], knot.cpIn[1]) || 0.001;
    const lenOut = Math.hypot(knot.cpOut[0], knot.cpOut[1]) || 0.001;
    // Mirror direction (-dx, -dy) scaled to original out length
    const ratio = lenOut / lenIn;
    knot.cpOut = [
      Math.max(0, -knot.cpIn[0] * ratio),
      -knot.cpIn[1] * ratio,
    ];
  } else if (activeHandle === 'cpOut' && knot.cpOut && knot.cpIn) {
    const lenOut = Math.hypot(knot.cpOut[0], knot.cpOut[1]) || 0.001;
    const lenIn = Math.hypot(knot.cpIn[0], knot.cpIn[1]) || 0.001;
    const ratio = lenIn / lenOut;
    knot.cpIn = [
      Math.min(0, -knot.cpOut[0] * ratio),
      -knot.cpOut[1] * ratio,
    ];
  }
}

/**
 * Applies a 4-parameter cubic easing preset to the span between two adjacent knots.
 */
export function applyEasingPresetToKnotPair(
  k0: BezierKnot,
  k1: BezierKnot,
  presetKey: BezierPresetName
): void {
  const [p1x, p1y, p2x, p2y] = BEZIER_PRESETS[presetKey] ?? BEZIER_PRESETS.ease;
  const dt = Math.max(0.001, k1.t - k0.t);
  const dv = k1.val - k0.val;

  k0.cpOut = [dt * p1x, dv * p1y];
  k1.cpIn = [dt * (p2x - 1), dv * (p2y - 1)];
  k0.tangentMode = 'broken';
  k1.tangentMode = 'broken';
}
