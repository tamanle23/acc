import { CaptionSettings, CaptionPreset, CaptionPosition } from './types';

/**
 * Converts standard HTML Hex Color (e.g. #FFCC00) to ASS format (&H0000CCFF)
 * ASS format is &HAABBGGRR
 */
/**
 * Calculates sRGB relative luminance according to W3C WCAG 2.1/2.2 guidelines.
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
export function getLuminance(hex: string): number {
  if (!hex) return 1.0;
  let cleanHex = hex.replace('#', '').toUpperCase();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  if (cleanHex.length !== 6) return 1.0;

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const R = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const G = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const B = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculates WCAG 2.2 contrast ratio between two hex colors.
 * Contrast Ratio = (L1 + 0.05) / (L2 + 0.05) where L1 > L2.
 */
export function calculateContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Converts standard HTML Hex Color (e.g. #FFCC00) to ASS format (&H0000CCFF)
 * ASS format is &HAABBGGRR
 */
export function hexToAss(hex: string): string {
  if (!hex) return '&H00FFFFFF';

  let cleanHex = hex.replace('#', '').toUpperCase();

  // Handle shorthand #FFF
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }

  if (cleanHex.length !== 6) return '&H00FFFFFF'; // Fallback to white

  const r = cleanHex.substring(0, 2);
  const g = cleanHex.substring(2, 4);
  const b = cleanHex.substring(4, 6);

  return `&H00${b}${g}${r}`;
}

type RequiredCaptionSettings = Required<
  Omit<CaptionSettings, 'preset' | 'position' | 'marginH' | 'marginL' | 'marginR' | 'subtitleMode'>
>;

export const PRESETS: Record<CaptionPreset, RequiredCaptionSettings> = {
  tiktok: {
    fontName: 'Segoe UI Black',
    fontSize: 54,
    primaryColor: '#FFFF00', // Neon Yellow
    outlineColor: '#000000',
    shadowColor: '#000000',
    outlineSize: 4,
    shadowSize: 2,
    alignment: 2,
    marginV: 90,
    borderStyle: 1,
  },
  classic: {
    fontName: 'Tahoma',
    fontSize: 44,
    primaryColor: '#FFFFFF',
    outlineColor: '#000000',
    shadowColor: '#000000',
    outlineSize: 3,
    shadowSize: 2,
    alignment: 2,
    marginV: 60,
    borderStyle: 1,
  },
  cinematic: {
    fontName: 'Georgia',
    fontSize: 42,
    primaryColor: '#FFFFFF',
    outlineColor: '#000000',
    shadowColor: '#000000',
    outlineSize: 0,
    shadowSize: 3,
    alignment: 2,
    marginV: 60,
    borderStyle: 1,
  },
  vlog: {
    fontName: 'Verdana',
    fontSize: 44,
    primaryColor: '#FFFFFF',
    outlineColor: '#000000',
    shadowColor: '#000000',
    outlineSize: 0,
    shadowSize: 0,
    alignment: 2,
    marginV: 70,
    borderStyle: 3, // Opaque Black Box behind text
  },
  'neon-glow': {
    fontName: 'Segoe UI Black',
    fontSize: 52,
    primaryColor: '#00FFFF', // Neon Cyan
    outlineColor: '#2A0845', // Deep Purple Outline
    shadowColor: '#00FFFF', // Neon Glow Shadow
    outlineSize: 3,
    shadowSize: 4,
    alignment: 2,
    marginV: 85,
    borderStyle: 1,
  },
  'bold-retro': {
    fontName: 'Segoe UI Black',
    fontSize: 54,
    primaryColor: '#FF7700', // Bright Orange
    outlineColor: '#000000', // Black Outline (Calibrated for WCAG 2.2 AA ≥ 4.5:1 text contrast)
    shadowColor: '#000000', // Black Shadow
    outlineSize: 3,
    shadowSize: 3,
    alignment: 2,
    marginV: 80,
    borderStyle: 1,
  },
  'minimal-clean': {
    fontName: 'Segoe UI',
    fontSize: 40,
    primaryColor: '#FFFFFF',
    outlineColor: '#000000',
    shadowColor: '#000000',
    outlineSize: 1,
    shadowSize: 0,
    alignment: 2,
    marginV: 50,
    borderStyle: 1,
  },
  karaoke: {
    fontName: 'Tahoma',
    fontSize: 50,
    primaryColor: '#00FF66', // Bright Lime Green
    outlineColor: '#003311', // Dark Forest Green
    shadowColor: '#000000',
    outlineSize: 3,
    shadowSize: 2,
    alignment: 2,
    marginV: 80,
    borderStyle: 1,
  },
  'news-banner': {
    fontName: 'Arial',
    fontSize: 42,
    primaryColor: '#FFFFFF',
    outlineColor: '#000000',
    shadowColor: '#001F3F', // Deep Navy Box
    outlineSize: 0,
    shadowSize: 0,
    alignment: 2,
    marginV: 50,
    borderStyle: 3, // Full Banner Box
  },
  'retro-typewriter': {
    fontName: 'Consolas',
    fontSize: 42,
    primaryColor: '#FFFDD0', // Vintage Ivory/Cream
    outlineColor: '#2C1A11', // Dark Brown Outline
    shadowColor: '#000000',
    outlineSize: 2,
    shadowSize: 2,
    alignment: 2,
    marginV: 60,
    borderStyle: 1,
  },
};

/**
 * Resolves ASS Alignment (1-9 numpad layout) from position string or explicit alignment
 */
export function resolveAlignment(
  position?: CaptionPosition,
  explicitAlignment?: number
): number {
  if (typeof explicitAlignment === 'number' && explicitAlignment >= 1 && explicitAlignment <= 9) {
    return explicitAlignment;
  }
  if (position) {
    switch (position) {
      case 'bottom':
      case 'bottom-center':
        return 2;
      case 'bottom-left':
        return 1;
      case 'bottom-right':
        return 3;
      case 'center':
      case 'middle':
        return 5;
      case 'top':
      case 'top-center':
        return 8;
      case 'top-left':
        return 7;
      case 'top-right':
        return 9;
      default:
        return 2;
    }
  }
  return 2;
}

export function getResolvedCaptionStyle(settings?: CaptionSettings): {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  shadowColor: string;
  outlineSize: number;
  shadowSize: number;
  alignment: number;
  marginV: number;
  marginL: number;
  marginR: number;
  borderStyle: number;
} {
  const presetName = settings?.preset || 'classic';
  const base = PRESETS[presetName] || PRESETS['classic'];

  const fontName = settings?.fontName ?? base.fontName;
  const fontSize = settings?.fontSize ?? base.fontSize;
  const primaryColor = hexToAss(settings?.primaryColor ?? base.primaryColor);
  const outlineColor = hexToAss(settings?.outlineColor ?? base.outlineColor);
  const shadowColor = hexToAss(settings?.shadowColor ?? base.shadowColor);
  const outlineSize = settings?.outlineSize ?? base.outlineSize;
  const shadowSize = settings?.shadowSize ?? base.shadowSize;
  const alignment = typeof settings?.alignment === 'number'
    ? resolveAlignment(undefined, settings.alignment)
    : settings?.position
      ? resolveAlignment(settings.position)
      : base.alignment;
  const marginV = settings?.marginV ?? base.marginV;
  const marginL = settings?.marginL ?? settings?.marginH ?? 40;
  const marginR = settings?.marginR ?? settings?.marginH ?? 40;
  const borderStyle = settings?.borderStyle ?? base.borderStyle;

  return {
    fontName,
    fontSize,
    primaryColor,
    outlineColor,
    shadowColor,
    outlineSize,
    shadowSize,
    alignment,
    marginV,
    marginL,
    marginR,
    borderStyle,
  };
}

/**
 * Returns the ASS override tags for highlighting the active word
 */
export function getHighlightAssTag(
  preset?: CaptionSettings['highlightPreset'],
  colorHex?: string
): string {
  const p = preset || 'none';
  if (p === 'none') return '';

  let tag = '';
  const assColor = colorHex ? hexToAss(colorHex) : hexToAss('#00FFFF'); // Default Neon Yellow/Cyan

  switch (p) {
    case 'color':
      tag = `\\c${assColor}`;
      break;
    case 'scale':
      tag = `\\fscx115\\fscy115`;
      break;
    case 'scale-color':
      tag = `\\c${assColor}\\fscx115\\fscy115`;
      break;
    case 'glow':
      // primary color + white outline + glow shadow + scale
      tag = `\\c${assColor}\\3c&HFFFFFF&\\4c${assColor}\\fscx115\\fscy115`;
      break;
    default:
      return '';
  }

  return `{${tag}}`;
}
