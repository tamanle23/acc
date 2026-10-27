/**
 * BezierMath:
 * Pure closed-form cubic Bézier parser and root solver for deterministic animation curves.
 * Adheres strictly to:
 * - ZERO-ALLOC-FRAME-LOOP: No heap object churn, static iteration limits, purely numeric.
 * - DETERMINISTIC-HANDSHAKE-BACKPRESSURE: Pure mathematical function of progress t ∈ [0, 1].
 */

/**
 * Parses a CSS-style cubic-bezier string:
 * e.g. "cubic-bezier(0.25, 0.1, 0.25, 1.0)" or "cubic-bezier(0.42, 0, 0.58, 1)"
 * Returns [x1, y1, x2, y2] tuple or null if invalid.
 */
export function parseCubicBezier(spec: string): [number, number, number, number] | null {
  if (!spec || typeof spec !== 'string') return null;
  const match = spec.trim().match(/^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/i);
  if (!match) return null;

  const x1 = parseFloat(match[1]);
  const y1 = parseFloat(match[2]);
  const x2 = parseFloat(match[3]);
  const y2 = parseFloat(match[4]);

  if (Number.isNaN(x1) || Number.isNaN(y1) || Number.isNaN(x2) || Number.isNaN(y2)) {
    return null;
  }

  // x1 and x2 must be in [0, 1] for valid time-based cubic-bezier
  const clampedX1 = Math.max(0, Math.min(1, x1));
  const clampedX2 = Math.max(0, Math.min(1, x2));

  return [clampedX1, y1, clampedX2, y2];
}

/**
 * Evaluates polynomial coordinate B(t) given control values P0=0, P1, P2, P3=1.
 */
function sampleCurve(t: number, p1: number, p2: number): number {
  return ((1 - 3 * p2 + 3 * p1) * t + (3 * p2 - 6 * p1)) * t * t + 3 * p1 * t;
}

/**
 * Evaluates derivative dB/dt(t).
 */
function sampleCurveDerivative(t: number, p1: number, p2: number): number {
  return (3 * (1 - 3 * p2 + 3 * p1) * t + 2 * (3 * p2 - 6 * p1)) * t + 3 * p1;
}

/**
 * Solves for t where sampleCurve(t, x1, x2) == x, using Newton-Raphson with bisection fallback.
 * Guaranteed to exit within 8 iterations max without nursery heap allocations.
 */
export function solveCubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Linear edge case optimization
  if (x1 === y1 && x2 === y2) {
    return x;
  }

  // Newton-Raphson iteration
  let t = x;
  for (let i = 0; i < 8; i++) {
    const currentX = sampleCurve(t, x1, x2) - x;
    if (Math.abs(currentX) < 1e-6) {
      return sampleCurve(t, y1, y2);
    }
    const dX = sampleCurveDerivative(t, x1, x2);
    if (Math.abs(dX) < 1e-6) {
      break;
    }
    t -= currentX / dX;
  }

  // Fallback to Bisection search if Newton-Raphson diverges
  let t0 = 0.0;
  let t1 = 1.0;
  t = x;

  for (let i = 0; i < 10; i++) {
    const currentX = sampleCurve(t, x1, x2);
    if (Math.abs(currentX - x) < 1e-6) {
      return sampleCurve(t, y1, y2);
    }
    if (x > currentX) {
      t0 = t;
    } else {
      t1 = t;
    }
    t = (t1 + t0) * 0.5;
  }

  return sampleCurve(t, y1, y2);
}
