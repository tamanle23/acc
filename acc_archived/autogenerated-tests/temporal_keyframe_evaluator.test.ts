import { describe, it, expect } from 'bun:test';
import {
  TemporalKeyframeEvaluator,
  evaluateEasingProgress,
} from '../packages/ir/src/renderer/preview/TemporalKeyframeEvaluator';
import { evaluateSequenceMotion } from '../packages/ir/src/renderer/preview/DeterministicMotionEvaluator';

describe('TemporalKeyframeEvaluator Suite', () => {
  it('should interpolate linear keyframe sequences', () => {
    const keyframes = [
      { timeSec: 0, value: 0, ease: 'linear' },
      { timeSec: 2, value: 100, ease: 'linear' },
    ];

    expect(TemporalKeyframeEvaluator.interpolateKeyframes(keyframes, -0.5)).toBe(0);
    expect(TemporalKeyframeEvaluator.interpolateKeyframes(keyframes, 0)).toBe(0);
    expect(TemporalKeyframeEvaluator.interpolateKeyframes(keyframes, 1)).toBeCloseTo(50, 4);
    expect(TemporalKeyframeEvaluator.interpolateKeyframes(keyframes, 2)).toBe(100);
    expect(TemporalKeyframeEvaluator.interpolateKeyframes(keyframes, 3)).toBe(100);
  });

  it('should interpolate multi-segment keyframes with piecewise Bézier curves', () => {
    const keyframes = [
      { timeSec: 0, value: 10, ease: 'ease-in' },
      { timeSec: 1, value: 50, ease: 'cubic-bezier(0.42, 0, 0.58, 1)' },
      { timeSec: 3, value: 200, ease: 'linear' },
    ];

    // Segment 1 (0 to 1s)
    const mid1 = TemporalKeyframeEvaluator.interpolateKeyframes(keyframes, 0.5);
    expect(mid1).toBeGreaterThan(10);
    expect(mid1).toBeLessThan(50);

    // Exact segment boundary (1s)
    expect(TemporalKeyframeEvaluator.interpolateKeyframes(keyframes, 1.0)).toBe(50);

    // Segment 2 (1 to 3s)
    const mid2 = TemporalKeyframeEvaluator.interpolateKeyframes(keyframes, 2.0);
    expect(mid2).toBeGreaterThan(50);
    expect(mid2).toBeLessThan(200);

    // Boundary at end
    expect(TemporalKeyframeEvaluator.interpolateKeyframes(keyframes, 3.5)).toBe(200);
  });

  it('should prioritize keyframes over scalar values in evaluateSequenceMotion', () => {
    const transformWithKeyframes = {
      x: {
        keyframes: [
          { timeSec: 0, value: 0, ease: 'linear' },
          { timeSec: 2, value: 200, ease: 'linear' },
        ],
      },
      scale: {
        keyframes: [
          { timeSec: 0, value: 1.0, ease: 'linear' },
          { timeSec: 2, value: 2.0, ease: 'linear' },
        ],
      },
      rotation: 45,
      opacity: 0.8,
    };

    const t0 = evaluateSequenceMotion(transformWithKeyframes, 0, 5);
    expect(t0.x).toBe(0);
    expect(t0.scale).toBe(1.0);
    expect(t0.rotation).toBe(45);
    expect(t0.opacity).toBe(0.8);

    const t1 = evaluateSequenceMotion(transformWithKeyframes, 1, 5);
    expect(t1.x).toBeCloseTo(100, 3);
    expect(t1.scale).toBeCloseTo(1.5, 3);

    const t2 = evaluateSequenceMotion(transformWithKeyframes, 2, 5);
    expect(t2.x).toBe(200);
    expect(t2.scale).toBe(2.0);
  });
});
