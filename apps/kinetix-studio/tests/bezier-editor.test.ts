// ============================================================================
// KINETIX STUDIO - DUAL-HANDLE BEZIER GRAPH EDITOR SUITE (MILESTONE A)
// Verifies tangent handle coordinate projection, horizontal monotonic clamping,
// angle-locking alignment modes (smooth, broken, flat), and preset injection.
// ============================================================================

import { describe, it, expect } from 'bun:test';
import type { BezierKnot } from '@/types/motion';
import {
  computeKnotTangentPoints,
  clampKnotTangents,
  alignTangents,
  applyEasingPresetToKnotPair,
  BEZIER_PRESETS,
} from '@/core/domain/motion';
import { evaluateBezierTrack } from '@/engine/choreography';

describe('Bézier Keyframe Graph Editor & Tangent Math Suite (Milestone A)', () => {
  const toSvgX = (t: number) => 20 + t * 500;
  const toSvgY = (v: number) => 20 + (1 - v) * 100;

  it('computes knot tangent points in pixel space accurately', () => {
    const knot: BezierKnot = {
      t: 0.5,
      val: 0.7,
      cpIn: [-0.1, -0.2],
      cpOut: [0.15, 0.1],
      tangentMode: 'smooth',
    };

    const pts = computeKnotTangentPoints(knot, toSvgX, toSvgY);

    expect(pts.knotX).toBeCloseTo(toSvgX(0.5), 2);
    expect(pts.knotY).toBeCloseTo(toSvgY(0.7), 2);
    expect(pts.inX).toBeCloseTo(toSvgX(0.4), 2);
    expect(pts.inY).toBeCloseTo(toSvgY(0.5), 2);
    expect(pts.outX).toBeCloseTo(toSvgX(0.65), 2);
    expect(pts.outY).toBeCloseTo(toSvgY(0.8), 2);
  });

  it('enforces horizontal monotonicity and prevents time loop reversals', () => {
    const invertedKnot: BezierKnot = {
      t: 0.4,
      val: 0.5,
      cpIn: [0.2, 0.1],   // Invalid positive in-tangent (points forward in time)
      cpOut: [-0.3, 0.1], // Invalid negative out-tangent (points backward in time)
    };

    clampKnotTangents(invertedKnot, 0.3, 0.3);

    // cpIn must be clamped <= 0
    expect(invertedKnot.cpIn?.[0]).toBeLessThanOrEqual(0);
    // cpOut must be clamped >= 0
    expect(invertedKnot.cpOut?.[0]).toBeGreaterThanOrEqual(0);
  });

  it('supports flat tangent mode zeroing vertical velocity slope', () => {
    const knot: BezierKnot = {
      t: 0.5,
      val: 0.8,
      cpIn: [-0.1, 0.3],
      cpOut: [0.1, -0.4],
      tangentMode: 'flat',
    };

    alignTangents(knot, 'cpOut', 'flat');

    expect(knot.cpIn?.[1]).toBe(0);
    expect(knot.cpOut?.[1]).toBe(0);
  });

  it('supports smooth mode mirroring collinear handle angles', () => {
    const knot: BezierKnot = {
      t: 0.5,
      val: 0.5,
      cpIn: [-0.1, -0.1],
      cpOut: [0.1, 0.1],
      tangentMode: 'smooth',
    };

    // User modifies cpOut to point upward-right
    knot.cpOut = [0.1, 0.2];
    alignTangents(knot, 'cpOut', 'smooth');

    // cpIn should mirror downward-left
    expect(knot.cpIn?.[0]).toBeLessThan(0);
    expect(knot.cpIn?.[1]).toBeLessThan(0);
  });

  it('applies easing presets between knot pairs cleanly', () => {
    const k0: BezierKnot = { t: 0.0, val: 0.0 };
    const k1: BezierKnot = { t: 1.0, val: 1.0 };

    applyEasingPresetToKnotPair(k0, k1, 'snappyBounce');

    expect(k0.cpOut).toBeDefined();
    expect(k1.cpIn).toBeDefined();

    const [p1x, p1y, p2x, p2y] = BEZIER_PRESETS.snappyBounce;
    expect(k0.cpOut?.[0]).toBeCloseTo(p1x, 3);
    expect(k0.cpOut?.[1]).toBeCloseTo(p1y, 3);
    expect(k1.cpIn?.[0]).toBeCloseTo(p2x - 1, 3);
    expect(k1.cpIn?.[1]).toBeCloseTo(p2y - 1, 3);

    // Evaluate track with these presets
    const valAtQuarter = evaluateBezierTrack([k0, k1], 0.25);
    expect(Number.isFinite(valAtQuarter)).toBe(true);
  });
});
