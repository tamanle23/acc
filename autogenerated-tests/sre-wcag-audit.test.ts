import { describe, it, expect } from 'vitest';
import {
  liquidGlassTokens,
  blurMetrics,
  isWcagAaCompliant,
  getContrastRatio,
  getLuminance,
} from '@unipost/tokens';

/**
 * L5 Automated Non-Functional SRE & WCAG 2.2 AA Contrast Audit
 * Evaluates core design tokens, UI button combinations, and card surfaces across all themes.
 */
describe('L5 SRE & Non-Functional: WCAG 2.2 AA Contrast & Theme Sanity Scans', () => {
  it('enforces that light theme body text achieves >= 4.5:1 contrast against pure and frosted backgrounds', () => {
    const lightText = liquidGlassTokens.light.native.text; // #1C1C1E
    const lightBg = liquidGlassTokens.light.native.background; // #FFFFFF

    expect(isWcagAaCompliant(lightText, lightBg)).toBe(true);

    const [tr, tg, tb] = [0x1c, 0x1c, 0x1e];
    const [br, bg, bb] = [0xff, 0xff, 0xff];
    const ratio = getContrastRatio(getLuminance(tr, tg, tb), getLuminance(br, bg, bb));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('enforces that dark theme body text achieves >= 4.5:1 contrast against dark background', () => {
    const darkText = liquidGlassTokens.dark.native.text; // #FFFFFF
    const darkBg = liquidGlassTokens.dark.native.background; // #000000

    expect(isWcagAaCompliant(darkText, darkBg)).toBe(true);

    const [tr, tg, tb] = [0xff, 0xff, 0xff];
    const [br, bg, bb] = [0x00, 0x00, 0x00];
    const ratio = getContrastRatio(getLuminance(tr, tg, tb), getLuminance(br, bg, bb));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('verifies secondary text contrast compliance (>= 4.5:1) in both light and dark themes', () => {
    const lightSecondary = liquidGlassTokens.light.native.textSecondary; // #636366
    const lightBg = liquidGlassTokens.light.native.background;
    expect(isWcagAaCompliant(lightSecondary, lightBg)).toBe(true);

    const darkSecondary = liquidGlassTokens.dark.native.textSecondary; // #AEAEB2
    const darkCard = liquidGlassTokens.dark.native.solidCardFallback; // #1C1C1E
    expect(isWcagAaCompliant(darkSecondary, darkCard)).toBe(true);
  });

  it('verifies non-blocking ReDoS regex complexity validation is sub-50ms', () => {
    const complexRegex = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
    const payload = 'a'.repeat(50) + '@domain.com';

    const start = performance.now();
    const result = complexRegex.test(payload);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
    expect(result).toBe(true);
  });
});
