// ============================================================================
// KINETIX STUDIO - CORE DOMAIN: COLOR & WCAG 2.2 AA CONTRAST (ECMA-429)
// Pure algorithmic color models, luminance math, and palette synthesis.
// Zero DOM or browser dependencies.
// ============================================================================

import type { PaletteTokens } from '@/types/studio';

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function hexToRgbNormalized(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
}

export function toRgbaString(color: string, alpha = 1): string {
  const clampedAlpha = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
  if (!color) return `rgba(18, 21, 30, ${clampedAlpha})`;

  if (color.startsWith('rgb')) {
    const parts = color.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${clampedAlpha})`;
    }
  }

  let clean = color.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  } else if (clean.length === 8) {
    clean = clean.slice(0, 6);
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16) || 0;
    const g = parseInt(clean.slice(2, 4), 16) || 0;
    const b = parseInt(clean.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
  }

  return `rgba(18, 21, 30, ${clampedAlpha})`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function calculateWcagContrast(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((brighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Detects whether a background color is high-key (light/paper/cream)
 * based on relative luminance (L > 0.55).
 */
export function isHighKeyBackground(bgHex: string): boolean {
  if (!bgHex) return false;
  try {
    return relativeLuminance(bgHex) > 0.55;
  } catch {
    return false;
  }
}

/**
 * Procedural High-Contrast Palette Synthesizer
 */
export function synthesizePalette(): PaletteTokens {
  const hue = Math.floor(Math.random() * 360);
  const compHue = (hue + 150) % 360;

  const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  return {
    bg: hslToHex(hue, 38, 5),
    surface: hslToHex(hue, 32, 11),
    ink: hslToHex(hue, 25, 97),
    accent: hslToHex(hue, 95, 58),
    accent2: hslToHex(compHue, 92, 56),
  };
}
