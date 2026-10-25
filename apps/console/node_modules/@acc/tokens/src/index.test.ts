import { describe, it, expect } from 'vitest';
import {
  liquidGlassTokens,
  blurMetrics,
  getContrastRatio,
  getLuminance,
  isWcagAaCompliant,
} from './index';

describe('@acc/tokens', () => {
  it('should expose standard blur metrics (8, 16, 24, 32, 40)', () => {
    expect(blurMetrics.subtle).toBe(8);
    expect(blurMetrics.standard).toBe(16);
    expect(blurMetrics.card).toBe(24);
    expect(blurMetrics.panel).toBe(32);
    expect(blurMetrics.deep).toBe(40);
  });

  it('should guarantee dark and light palettes exist with specular highlights', () => {
    expect(liquidGlassTokens.light.glass.specular).toBeDefined();
    expect(liquidGlassTokens.dark.glass.specular).toBeDefined();
    expect(liquidGlassTokens.light.native.glassShine).toHaveLength(3);
    expect(liquidGlassTokens.dark.native.glassShine).toHaveLength(3);
  });

  it('should enforce WCAG 2.2 AA contrast >= 4.5:1 for light mode text and secondary text', () => {
    const light = liquidGlassTokens.light.native;
    // Primary text #1C1C1E against white #FFFFFF
    expect(isWcagAaCompliant(light.text, light.background)).toBe(true);

    // Secondary text #636366 against white #FFFFFF
    expect(isWcagAaCompliant(light.textSecondary, light.background)).toBe(true);
  });

  it('should enforce WCAG 2.2 AA contrast >= 4.5:1 for dark mode text and secondary text', () => {
    const dark = liquidGlassTokens.dark.native;
    // Primary text #FFFFFF against black #000000
    expect(isWcagAaCompliant(dark.text, dark.background)).toBe(true);

    // Secondary text #AEAEB2 against dark solid card #1C1C1E
    expect(isWcagAaCompliant(dark.textSecondary, dark.solidCardFallback)).toBe(true);
  });

  it('should provide valid multi-tenant theme presets and apply CSS variable overrides', async () => {
    const { defaultTenantThemes, applyTenantThemeOverrides } = await import('./index');
    expect(defaultTenantThemes['tenant-healthcare']).toBeDefined();
    expect(defaultTenantThemes['tenant-realestate']).toBeDefined();
    expect(defaultTenantThemes['tenant-fleet']).toBeDefined();

    // Mock DOM Element
    const styles: Record<string, string> = {};
    const mockElem = {
      style: {
        setProperty: (key: string, val: string) => {
          styles[key] = val;
        },
        removeProperty: (key: string) => {
          delete styles[key];
        },
      },
    } as unknown as HTMLElement;

    // Apply healthcare theme
    applyTenantThemeOverrides(defaultTenantThemes['tenant-healthcare'], mockElem);
    expect(styles['--primary']).toBe('#059669');
    expect(styles['--accent']).toBe('#D1FAE5');
    expect(styles['--radius']).toBe('0.5rem');

    // Apply realestate theme
    applyTenantThemeOverrides(defaultTenantThemes['tenant-realestate'], mockElem);
    expect(styles['--primary']).toBe('#7C3AED');
    expect(styles['--radius']).toBe('1rem');

    // Revert overrides
    applyTenantThemeOverrides(null, mockElem);
    expect(styles['--primary']).toBeUndefined();
    expect(styles['--radius']).toBeUndefined();
  });
});
