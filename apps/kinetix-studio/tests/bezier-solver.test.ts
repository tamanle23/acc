import { describe, it, expect } from 'bun:test';
import {
  UnitBezier,
  BEZIER_PRESETS,
  createBezierEasing,
  getBezierPresetCoordinates,
  type BezierPresetName,
} from '@/core/domain/motion';

describe('Studio-Grade Unit Bézier Polynomial Solver Suite', () => {
  it('correctly clamps endpoints: x=0 -> y=0 and x=1 -> y=1', () => {
    const solver = new UnitBezier(0.25, 0.1, 0.25, 1.0);
    expect(solver.solve(0)).toBe(0);
    expect(solver.solve(1)).toBe(1);
    expect(solver.solve(-0.5)).toBe(0);
    expect(solver.solve(1.5)).toBe(1);
  });

  it('linear preset resolves identical y ≈ x across the domain', () => {
    const linearSolver = new UnitBezier(0, 0, 1, 1);
    const testPoints = [0.1, 0.25, 0.5, 0.75, 0.9];
    for (const x of testPoints) {
      expect(linearSolver.solve(x)).toBeCloseTo(x, 4);
    }
  });

  it('evaluates all 8 standard Bézier presets smoothly without NaN or divergence', () => {
    const presetNames = Object.keys(BEZIER_PRESETS) as BezierPresetName[];
    expect(presetNames.length).toBe(8);

    for (const name of presetNames) {
      const [p1x, p1y, p2x, p2y] = getBezierPresetCoordinates(name);
      const solver = new UnitBezier(p1x, p1y, p2x, p2y);

      // Check continuity across 20 intermediate steps
      for (let i = 0; i <= 20; i++) {
        const x = i / 20;
        const y = solver.solve(x);
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isNaN(y)).toBe(false);
      }
    }
  });

  it('demonstrates elastic overshoot for snappyBounce and gentleSpring', () => {
    const springEasing = createBezierEasing('gentleSpring');
    const bounceEasing = createBezierEasing('snappyBounce');

    // Both spring and bounce overshoot 1.0 before settling
    let springMax = 0;
    let bounceMax = 0;
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      springMax = Math.max(springMax, springEasing(t));
      bounceMax = Math.max(bounceMax, bounceEasing(t));
    }

    expect(springMax).toBeGreaterThan(1.0);
    expect(bounceMax).toBeGreaterThan(1.0);
  });

  it('calculates instantaneous velocity dy/dx for motion physics', () => {
    const solver = new UnitBezier(0.25, 0.1, 0.25, 1.0);
    const vMid = solver.getVelocity(0.5);
    expect(Number.isFinite(vMid)).toBe(true);
    expect(vMid).toBeGreaterThan(0);

    // Endpoints return 0
    expect(solver.getVelocity(0)).toBe(0);
    expect(solver.getVelocity(1)).toBe(0);
  });

  it('createBezierEasing works seamlessly with custom coordinate tuples', () => {
    const customEase = createBezierEasing([0.5, 0.0, 0.5, 1.0]);
    expect(customEase(0)).toBe(0);
    expect(customEase(0.5)).toBeCloseTo(0.5, 3);
    expect(customEase(1)).toBe(1);
  });
});
