import { describe, it, expect } from 'bun:test';
import { SpatialConformanceHelper } from '../packages/ir/src/renderer/shared/SpatialConformanceHelper';

describe('SpatialConformanceHelper', () => {
  it('computes exact 16:9 asset on 16:9 timeline canvas', () => {
    const res = SpatialConformanceHelper.calculateDrawMapping(
      1920,
      1080,
      1920,
      1080,
      'cover'
    );
    expect(res.dx).toBe(0);
    expect(res.dy).toBe(0);
    expect(res.dw).toBe(1920);
    expect(res.dh).toBe(1080);
    expect(res.sx).toBe(0);
    expect(res.sy).toBe(0);
    expect(res.sw).toBe(1920);
    expect(res.sh).toBe(1080);
    expect(res.needsDownsamplePyramid).toBe(false);
  });

  it('correctly pillarboxes 9:16 vertical video on 16:9 canvas in fit mode', () => {
    // 1080x1920 on 1920x1080
    const res = SpatialConformanceHelper.calculateDrawMapping(
      1920,
      1080,
      1080,
      1920,
      'fit'
    );
    // Scale is limited by height: 1080 / 1920 = 0.5625
    // dw = 1080 * 0.5625 = 607.5
    // dh = 1920 * 0.5625 = 1080
    expect(res.dh).toBe(1080);
    expect(res.dw).toBe(607.5);
    expect(res.dy).toBe(0);
    expect(res.dx).toBe((1920 - 607.5) * 0.5);
  });

  it('correctly crops top/bottom for 9:16 vertical video on 16:9 canvas in cover mode', () => {
    const res = SpatialConformanceHelper.calculateDrawMapping(
      1920,
      1080,
      1080,
      1920,
      'cover'
    );
    // Scale is limited by width: 1920 / 1080 = 1.7777778
    // dw = 1080 * 1.7777778 = 1920
    // dh = 1920 * 1.7777778 = 3413.3333333333335
    expect(res.dw).toBe(1920);
    expect(res.dh).toBeCloseTo(3413.33, 1);
    expect(res.dx).toBe(0);
    expect(res.dy).toBeLessThan(0); // Centered and cropped vertically
  });

  it('handles stretch mode by non-uniformly mapping to canvas dimensions', () => {
    const res = SpatialConformanceHelper.calculateDrawMapping(
      1920,
      1080,
      640,
      480,
      'stretch'
    );
    expect(res.dx).toBe(0);
    expect(res.dy).toBe(0);
    expect(res.dw).toBe(1920);
    expect(res.dh).toBe(1080);
  });

  it('handles center mode with 1:1 pixel mapping', () => {
    const res = SpatialConformanceHelper.calculateDrawMapping(
      1920,
      1080,
      800,
      600,
      'center'
    );
    expect(res.dw).toBe(800);
    expect(res.dh).toBe(600);
    expect(res.dx).toBe((1920 - 800) * 0.5);
    expect(res.dy).toBe((1080 - 600) * 0.5);
  });

  it('applies normalized crop margins correctly to source rectangle', () => {
    const crop = { top: 0.1, bottom: 0.2, left: 0.15, right: 0.05 };
    const res = SpatialConformanceHelper.calculateDrawMapping(
      1920,
      1080,
      1000,
      1000,
      'cover',
      crop
    );
    expect(res.sx).toBe(150); // 1000 * 0.15
    expect(res.sy).toBe(100); // 1000 * 0.1
    expect(res.sw).toBe(800); // 1000 * (1 - 0.15 - 0.05)
    expect(res.sh).toBe(700); // 1000 * (1 - 0.1 - 0.2)
  });

  it('applies anamorphic Pixel Aspect Ratio (PAR) desqueeze', () => {
    // 1440x1080 anamorphic HDV with PAR 1.333333 -> effective 1920x1080
    const par = 1920 / 1440;
    const res = SpatialConformanceHelper.calculateDrawMapping(
      1920,
      1080,
      1440,
      1080,
      'fit',
      undefined,
      par
    );
    expect(res.dw).toBeCloseTo(1920, 0);
    expect(res.dh).toBeCloseTo(1080, 0);
    expect(res.dx).toBeCloseTo(0, 0);
    expect(res.dy).toBeCloseTo(0, 0);
  });

  it('flags downsample pyramid needed when asset scale exceeds 2.0x downscale', () => {
    // 8000x6000 downscaled to 1920x1080 (downscale ratio > 4.0)
    const res = SpatialConformanceHelper.calculateDrawMapping(
      1920,
      1080,
      8000,
      6000,
      'cover'
    );
    expect(res.needsDownsamplePyramid).toBe(true);
    expect(res.pyramidSteps).toBeGreaterThanOrEqual(2);
  });
});
