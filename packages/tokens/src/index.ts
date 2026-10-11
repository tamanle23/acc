/**
 * Liquid Glass Cross-Platform Design Tokens (@unipost/tokens)
 * Authoritative unified tokens enforcing WCAG 2.2 AA (>= 4.5:1 text contrast)
 * and seamless visual alignment across Web (Console, Tekgo) and Native Mobile.
 */

export interface ColorPalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  destructive: string;
  border: string;
  ring: string;
}

export interface GlassTokens {
  background: string;
  border: string;
  specular: string;
  shadow: string;
  fallbackBackground: string;
  fallbackBorder: string;
  shineGradient: readonly [string, string, string];
}

export interface BlurMetrics {
  subtle: number;   // 8px
  standard: number; // 16px
  card: number;     // 24px
  panel: number;    // 32px
  deep: number;     // 40px
}

export const blurMetrics: BlurMetrics = {
  subtle: 8,
  standard: 16,
  card: 24,
  panel: 32,
  deep: 40,
};

export const liquidGlassTokens = {
  light: {
    // Web OKLCH / CSS representations
    web: {
      background: 'oklch(0.985 0.005 250)',
      foreground: 'oklch(0.129 0.042 264.695)',
      card: 'oklch(1 0 0 / 65%)', // Mandatory >= 65% opacity for contrast
      cardForeground: 'oklch(0.129 0.042 264.695)',
      popover: 'oklch(1 0 0 / 80%)',
      primary: 'oklch(0.208 0.042 265.755)',
      primaryForeground: 'oklch(0.984 0.003 247.858)',
      secondary: 'oklch(0.968 0.007 247.896 / 70%)',
      muted: 'oklch(0.968 0.007 247.896 / 50%)',
      mutedForeground: 'oklch(0.45 0.046 257.417)', // Darkened for WCAG AA
      accent: 'oklch(0.968 0.007 247.896 / 60%)',
      destructive: 'oklch(0.577 0.245 27.325)',
      border: 'oklch(0.9 0.015 255 / 45%)',
      ring: 'oklch(0.704 0.04 256.788)',
    },
    // Mobile React Native Hex / RGBA representations
    native: {
      background: '#FFFFFF',
      text: '#1C1C1E',
      textSecondary: '#636366', // WCAG AA compliant >= 4.5:1 against white/scrim
      glassBackground: 'rgba(255, 255, 255, 0.75)', // >= 65% scrim
      glassBorder: 'rgba(0, 0, 0, 0.08)',
      glassHighlight: 'rgba(255, 255, 255, 0.90)',
      glassShine: [
        'rgba(255, 255, 255, 0.50)',
        'rgba(255, 255, 255, 0.05)',
        'rgba(255, 255, 255, 0.00)',
      ] as const,
      tint: '#007AFF',
      tabBarBackground: 'rgba(255, 255, 255, 0.85)',
      solidFallback: '#F2F2F7',
      solidCardFallback: '#FFFFFF',
      solidBorder: 'rgba(0, 0, 0, 0.12)',
    },
    glass: {
      background: 'rgba(255, 255, 255, 0.70)',
      border: 'rgba(255, 255, 255, 0.40)',
      specular: 'rgba(255, 255, 255, 0.90)',
      shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.06)',
      fallbackBackground: '#FFFFFF',
      fallbackBorder: 'rgba(0, 0, 0, 0.10)',
      shineGradient: [
        'rgba(255, 255, 255, 0.50)',
        'rgba(255, 255, 255, 0.05)',
        'rgba(255, 255, 255, 0.00)',
      ] as const,
    },
  },
  dark: {
    web: {
      background: 'oklch(0.12 0.035 264.695)',
      foreground: 'oklch(0.984 0.003 247.858)',
      card: 'oklch(0.16 0.035 259.21 / 65%)', // Mandatory >= 65% opacity
      cardForeground: 'oklch(0.984 0.003 247.858)',
      popover: 'oklch(0.18 0.038 265.755 / 80%)',
      primary: 'oklch(0.929 0.013 255.508)',
      primaryForeground: 'oklch(0.208 0.042 265.755)',
      secondary: 'oklch(0.25 0.035 260.031 / 55%)',
      muted: 'oklch(0.25 0.035 260.031 / 45%)',
      mutedForeground: 'oklch(0.75 0.04 256.788)', // Lightened for WCAG AA in dark
      accent: 'oklch(0.25 0.035 260.031 / 50%)',
      destructive: 'oklch(0.704 0.191 22.216)',
      border: 'oklch(1 0 0 / 14%)',
      ring: 'oklch(0.551 0.027 264.364)',
    },
    native: {
      background: '#000000',
      text: '#FFFFFF',
      textSecondary: '#AEAEB2', // WCAG AA compliant in dark
      glassBackground: 'rgba(30, 30, 35, 0.70)', // >= 65% scrim
      glassBorder: 'rgba(255, 255, 255, 0.18)',
      glassHighlight: 'rgba(255, 255, 255, 0.30)',
      glassShine: [
        'rgba(255, 255, 255, 0.15)',
        'rgba(255, 255, 255, 0.02)',
        'rgba(255, 255, 255, 0.00)',
      ] as const,
      tint: '#0A84FF',
      tabBarBackground: 'rgba(28, 28, 30, 0.80)',
      solidFallback: '#121212',
      solidCardFallback: '#1C1C1E',
      solidBorder: 'rgba(255, 255, 255, 0.12)',
    },
    glass: {
      background: 'rgba(30, 30, 35, 0.70)',
      border: 'rgba(255, 255, 255, 0.15)',
      specular: 'rgba(255, 255, 255, 0.30)',
      shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      fallbackBackground: '#1C1C1E',
      fallbackBorder: 'rgba(255, 255, 255, 0.10)',
      shineGradient: [
        'rgba(255, 255, 255, 0.15)',
        'rgba(255, 255, 255, 0.02)',
        'rgba(255, 255, 255, 0.00)',
      ] as const,
    },
  },
  amber: {
    glassBackground: 'rgba(245, 158, 11, 0.15)',
    glassBorder: 'rgba(245, 158, 11, 0.35)',
    glassSpecular: 'rgba(254, 243, 199, 0.65)',
    glassShadow: '0 4px 20px 0 rgba(245, 158, 11, 0.12)',
  },
} as const;

/**
 * Calculates WCAG 2.2 Relative Luminance of an sRGB color.
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates contrast ratio between two relative luminance values.
 * Returns ratio in format X:1 (e.g. 4.5 for 4.5:1).
 */
export function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Verifies whether text on a background meets WCAG 2.2 AA requirement (>= 4.5:1).
 */
export function isWcagAaCompliant(textHex: string, bgHex: string): boolean {
  const parseHex = (hex: string): [number, number, number] => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const [tr, tg, tb] = parseHex(textHex);
  const [br, bg, bb] = parseHex(bgHex);

  const textLum = getLuminance(tr, tg, tb);
  const bgLum = getLuminance(br, bg, bb);

  return getContrastRatio(textLum, bgLum) >= 4.5;
}
