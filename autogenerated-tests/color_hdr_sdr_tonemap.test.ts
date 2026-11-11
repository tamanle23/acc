import { describe, it, expect } from 'bun:test';
import { ColorConformanceEngine } from '../packages/ir/src/renderer/color/ColorConformanceEngine';

describe('ColorConformanceEngine', () => {
  it('evaluates ACES Filmic tone mapping curve within valid bounds', () => {
    // Zero input -> zero output
    expect(ColorConformanceEngine.evaluateACESFilmic(0)).toBe(0);

    // Mid-range inputs
    const mid = ColorConformanceEngine.evaluateACESFilmic(0.5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1.0);

    // Normal SDR white (1.0) maps near 0.8
    const white = ColorConformanceEngine.evaluateACESFilmic(1.0);
    expect(white).toBeGreaterThan(0.7);
    expect(white).toBeLessThan(0.9);

    // Extreme HDR peak luminance (10.0 nits peak highlights) compresses smoothly <= 1.0 without NaN
    const peak = ColorConformanceEngine.evaluateACESFilmic(10.0);
    expect(peak).toBeLessThanOrEqual(1.0);
    expect(peak).toBeGreaterThan(white);
    expect(Number.isFinite(peak)).toBe(true);
  });

  it('evaluates Reinhard tone mapping smoothly', () => {
    expect(ColorConformanceEngine.evaluateReinhard(0)).toBe(0);
    const mid = ColorConformanceEngine.evaluateReinhard(1.0);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThanOrEqual(1.0);
  });

  it('transforms Rec.2020 primaries into Rec.709 color gamut', () => {
    // Pure Rec.2020 Red [1, 0, 0] transformed to Rec.709
    const [r, g, b] = ColorConformanceEngine.convertRec2020ToRec709(1.0, 0.0, 0.0);
    expect(r).toBeCloseTo(1.6605, 4);
    expect(g).toBeCloseTo(-0.1246, 4);
    expect(b).toBeCloseTo(-0.0182, 4);
  });

  it('applies in-place RGBA buffer tone mapping without corruption or overflow', () => {
    // 2 pixels: pixel 1 = [255, 128, 64, 255], pixel 2 = [0, 0, 0, 255]
    const buf = new Uint8Array([255, 128, 64, 255, 0, 0, 0, 255]);
    ColorConformanceEngine.tonemapRgbaBufferInPlace(buf, 'aces');

    // Alpha channel must be preserved exactly
    expect(buf[3]).toBe(255);
    expect(buf[7]).toBe(255);

    // Black pixel remains 0
    expect(buf[4]).toBe(0);
    expect(buf[5]).toBe(0);
    expect(buf[6]).toBe(0);

    // Highlight pixel is tone mapped into [0, 255]
    expect(buf[0]).toBeGreaterThan(0);
    expect(buf[0]).toBeLessThanOrEqual(255);
  });

  it('generates preview CSS filters for HDR and Log profiles without CPU pixel stall', () => {
    expect(ColorConformanceEngine.getPreviewCssFilter('srgb')).toBe('none');
    expect(ColorConformanceEngine.getPreviewCssFilter('rec709')).toBe('none');

    const hdrFilter = ColorConformanceEngine.getPreviewCssFilter('hlg');
    expect(hdrFilter).toContain('contrast');
    expect(hdrFilter).toContain('saturate');

    const logFilter = ColorConformanceEngine.getPreviewCssFilter('slog3');
    expect(logFilter).toContain('contrast');
  });
});
