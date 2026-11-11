import { describe, it, expect } from 'bun:test';
import {
  rgbToCmyk,
  hexToCmyk,
  cmykToRgb,
  calculateTotalAreaCoverage,
  formatCmykPercent,
  formatPdfDeviceCmyk,
  CMYK_BLACKS,
  DEFAULT_TAC_LIMIT,
} from '@/core/domain/color';

describe('Studio-Grade Pre-Press DeviceCMYK Separation Suite', () => {
  it('safely handles pure black (R=0, G=0, B=0) without division-by-zero NaN', () => {
    const cmyk = rgbToCmyk(0, 0, 0);
    expect(cmyk.c).toBe(0);
    expect(cmyk.m).toBe(0);
    expect(cmyk.y).toBe(0);
    expect(cmyk.k).toBe(1);
    expect(Number.isNaN(cmyk.c)).toBe(false);
    expect(Number.isNaN(cmyk.k)).toBe(false);
  });

  it('converts pure white (R=1, G=1, B=1) to zero ink coverage', () => {
    const cmyk = rgbToCmyk(1, 1, 1);
    expect(cmyk.c).toBe(0);
    expect(cmyk.m).toBe(0);
    expect(cmyk.y).toBe(0);
    expect(cmyk.k).toBe(0);
    expect(calculateTotalAreaCoverage(cmyk)).toBe(0);
  });

  it('converts pure primary RGB colors accurately', () => {
    // Pure Red -> 0% Cyan, 100% Magenta, 100% Yellow, 0% Black
    const red = rgbToCmyk(1, 0, 0);
    expect(red.c).toBeCloseTo(0, 3);
    expect(red.m).toBeCloseTo(1, 3);
    expect(red.y).toBeCloseTo(1, 3);
    expect(red.k).toBeCloseTo(0, 3);

    // Pure Green -> 100% Cyan, 0% Magenta, 100% Yellow, 0% Black
    const green = rgbToCmyk(0, 1, 0);
    expect(green.c).toBeCloseTo(1, 3);
    expect(green.m).toBeCloseTo(0, 3);
    expect(green.y).toBeCloseTo(1, 3);
    expect(green.k).toBeCloseTo(0, 3);

    // Pure Blue -> 100% Cyan, 100% Magenta, 0% Yellow, 0% Black
    const blue = rgbToCmyk(0, 0, 1);
    expect(blue.c).toBeCloseTo(1, 3);
    expect(blue.m).toBeCloseTo(1, 3);
    expect(blue.y).toBeCloseTo(0, 3);
    expect(blue.k).toBeCloseTo(0, 3);
  });

  it('enforces Total Area Coverage (TAC) clamping to prevent press over-inking', () => {
    // Construct an artificial color with high ink density
    const customTacLimit = 2.4; // 240% max TAC for newsprint/uncoated
    const cmyk = rgbToCmyk(0.05, 0.05, 0.05, customTacLimit);

    const totalInk = cmyk.c + cmyk.m + cmyk.y + cmyk.k;
    expect(totalInk).toBeLessThanOrEqual(customTacLimit + 0.001);
  });

  it('parses both 3-digit and 6-digit hex color codes', () => {
    const from6 = hexToCmyk('#ff0000');
    expect(from6.m).toBeCloseTo(1, 3);
    expect(from6.y).toBeCloseTo(1, 3);

    const from3 = hexToCmyk('#0f0');
    expect(from3.c).toBeCloseTo(1, 3);
    expect(from3.y).toBeCloseTo(1, 3);
  });

  it('performs accurate round-trip sRGB <-> DeviceCMYK conversion', () => {
    const origR = 0.8;
    const origG = 0.3;
    const origB = 0.5;

    const cmyk = rgbToCmyk(origR, origG, origB);
    const rgb = cmykToRgb(cmyk);

    expect(rgb.r).toBeCloseTo(origR, 2);
    expect(rgb.g).toBeCloseTo(origG, 2);
    expect(rgb.b).toBeCloseTo(origB, 2);
  });

  it('formats PDF DeviceCMYK operators and human-readable percentages', () => {
    const cmyk = CMYK_BLACKS.rich;
    expect(formatCmykPercent(cmyk)).toBe('C:60% M:40% Y:30% K:100%');
    expect(formatPdfDeviceCmyk(cmyk, 'k')).toBe('0.6000 0.4000 0.3000 1.0000 k');
    expect(formatPdfDeviceCmyk(cmyk, 'K')).toBe('0.6000 0.4000 0.3000 1.0000 K');
  });
});
