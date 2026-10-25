import { describe, test, expect } from 'bun:test';
import { PRESETS, getLuminance, calculateContrastRatio } from '../packages/effect-engines/src/styles/styles';

describe('WCAG 2.2 Level AA Accessibility & Contrast Compliance', () => {
  test('getLuminance calculates accurate sRGB relative luminance', () => {
    expect(getLuminance('#FFFFFF')).toBeCloseTo(1.0, 3);
    expect(getLuminance('#000000')).toBeCloseTo(0.0, 3);
    expect(getLuminance('#FF0000')).toBeCloseTo(0.2126, 3);
  });

  test('calculateContrastRatio produces correct W3C contrast ratios', () => {
    const ratio = calculateContrastRatio('#FFFFFF', '#000000');
    expect(ratio).toBeCloseTo(21.0, 1);
  });

  test('All 10 Caption Presets satisfy WCAG 2.2 Level AA contrast (>= 4.5:1)', () => {
    const presetKeys = Object.keys(PRESETS) as Array<keyof typeof PRESETS>;
    expect(presetKeys.length).toBe(10);

    for (const key of presetKeys) {
      const preset = PRESETS[key];
      // Test contrast of primary text color against outline color or shadow/box color
      const outlineRatio = calculateContrastRatio(preset.primaryColor, preset.outlineColor);
      const shadowRatio = calculateContrastRatio(preset.primaryColor, preset.shadowColor);

      const maxContrast = Math.max(outlineRatio, shadowRatio);

      expect(maxContrast).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('bold-retro preset satisfies WCAG 2.2 AA contrast >= 4.5:1 with black outline', () => {
    const preset = PRESETS['bold-retro'];
    const outlineRatio = calculateContrastRatio(preset.primaryColor, preset.outlineColor);
    expect(outlineRatio).toBeGreaterThanOrEqual(4.5);
    expect(preset.outlineColor).toBe('#000000');
  });
});
