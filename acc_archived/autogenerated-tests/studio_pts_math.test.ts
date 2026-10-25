import { describe, it, expect } from 'bun:test';
import { DepthMathEngine } from '../apps/studio/src/lib/math/DepthMathEngine';

describe('pts.js DepthMathEngine Vector Math Parity (Phase 5 Ext)', () => {
  it('computes smooth, deterministic 2.5D camera parallax vectors', () => {
    const v1 = DepthMathEngine.computeParallax(0, 30, 1.0, 0.5, 0.5);
    const v2 = DepthMathEngine.computeParallax(15, 30, 1.0, 0.5, 0.5);
    const v3 = DepthMathEngine.computeParallax(30, 30, 1.0, 0.5, 0.5);

    expect(Number.isFinite(v1.offsetX)).toBe(true);
    expect(Number.isFinite(v1.offsetY)).toBe(true);
    expect(Number.isFinite(v1.zoom)).toBe(true);
    expect(Number.isFinite(v1.rotation)).toBe(true);

    // Verify time-displacement changes position deterministically
    expect(v1.offsetX).not.toBe(v2.offsetX);
    expect(v2.offsetY).not.toBe(v3.offsetY);
  });

  it('computes stereo eye separation vectors for wigglegram', () => {
    const stereo1 = DepthMathEngine.computeWigglegram(0, 30, 4.0, 15.0);
    const stereo2 = DepthMathEngine.computeWigglegram(8, 30, 4.0, 15.0);

    expect(Number.isFinite(stereo1.phase)).toBe(true);
    expect(Number.isFinite(stereo1.leftEyeOffset.x)).toBe(true);
    expect(Number.isFinite(stereo1.rightEyeOffset.x)).toBe(true);

    // Left and right eye offsets must be opposite and symmetric
    expect(stereo2.leftEyeOffset.x).toBe(-stereo2.rightEyeOffset.x);
  });

  it('computes frame breaker inner frame bounds and breach thresholds', () => {
    const bounds = DepthMathEngine.computeFrameBreakerBounds(1920, 1080, 1.5);

    expect(bounds.innerFrame.length).toBe(2);
    expect(bounds.innerFrame[0].x).toBe(192); // 10% of 1920
    expect(bounds.innerFrame[0].y).toBe(108); // 10% of 1080
    expect(bounds.innerFrame[1].x).toBe(1920 - 192);
    expect(bounds.innerFrame[1].y).toBe(1080 - 108);
    expect(bounds.breachThreshold).toBe(108 * 1.5);
  });
});
