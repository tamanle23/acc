import { describe, it, expect } from 'bun:test';
import { parseCubicBezier, solveCubicBezier } from '../packages/ir/src/renderer/preview/BezierMath';
import { evaluateEase } from '../packages/ir/src/renderer/preview/DeterministicMotionEvaluator';

describe('Deterministic Cubic Bézier Evaluator & Solver Suite', () => {
  describe('parseCubicBezier', () => {
    it('correctly parses valid cubic-bezier strings', () => {
      const res = parseCubicBezier('cubic-bezier(0.25, 0.1, 0.25, 1.0)');
      expect(res).not.toBeNull();
      expect(res![0]).toBeCloseTo(0.25, 3);
      expect(res![1]).toBeCloseTo(0.1, 3);
      expect(res![2]).toBeCloseTo(0.25, 3);
      expect(res![3]).toBeCloseTo(1.0, 3);
    });

    it('handles negative values and integers in coordinates', () => {
      const res = parseCubicBezier('cubic-bezier(0.42, -0.5, 0.58, 1.5)');
      expect(res).not.toBeNull();
      expect(res![0]).toBeCloseTo(0.42, 3);
      expect(res![1]).toBeCloseTo(-0.5, 3);
      expect(res![2]).toBeCloseTo(0.58, 3);
      expect(res![3]).toBeCloseTo(1.5, 3);
    });

    it('returns null for invalid strings', () => {
      expect(parseCubicBezier('linear')).toBeNull();
      expect(parseCubicBezier('cubic-bezier(abc, def)')).toBeNull();
      expect(parseCubicBezier('')).toBeNull();
    });
  });

  describe('solveCubicBezier', () => {
    it('evaluates boundary points x=0 and x=1 exactly', () => {
      expect(solveCubicBezier(0.25, 0.1, 0.25, 1.0, 0)).toBe(0);
      expect(solveCubicBezier(0.25, 0.1, 0.25, 1.0, 1)).toBe(1);
    });

    it('evaluates linear curve identically', () => {
      for (let x = 0; x <= 1.0; x += 0.1) {
        expect(solveCubicBezier(0, 0, 1, 1, x)).toBeCloseTo(x, 4);
      }
    });

    it('evaluates CSS standard ease-in (0.42, 0, 1, 1)', () => {
      const yMid = solveCubicBezier(0.42, 0, 1, 1, 0.5);
      // For ease-in, y at 0.5 should be well below 0.5 (slow start)
      expect(yMid).toBeLessThan(0.4);
      expect(yMid).toBeGreaterThan(0.2);
    });

    it('evaluates CSS standard ease-out (0, 0, 0.58, 1)', () => {
      const yMid = solveCubicBezier(0, 0, 0.58, 1, 0.5);
      // For ease-out, y at 0.5 should be well above 0.5 (fast start)
      expect(yMid).toBeGreaterThan(0.6);
      expect(yMid).toBeLessThan(0.85);
    });
  });

  describe('evaluateEase with cubic-bezier', () => {
    it('evaluates custom cubic-bezier strings seamlessly within evaluateEase', () => {
      const curveStr = 'cubic-bezier(0.25, 0.1, 0.25, 1.0)';
      expect(evaluateEase(curveStr, 0)).toBe(0);
      expect(evaluateEase(curveStr, 1)).toBe(1);
      const valMid = evaluateEase(curveStr, 0.5);
      expect(valMid).toBeGreaterThan(0.5);
    });
  });
});
