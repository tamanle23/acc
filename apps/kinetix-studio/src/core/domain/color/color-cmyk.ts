// ============================================================================
// KINETIX STUDIO - CORE DOMAIN: DEVICE-CMYK SEPARATION & TAC LIMITING (ECMA-429)
// Certified 4-color process separation engine with Total Area Coverage (TAC)
// clamping, Under Color Removal (UCR), and PostScript / PDF operator formatting.
// ============================================================================

export interface CmykColor {
  readonly c: number; // Cyan [0, 1]
  readonly m: number; // Magenta [0, 1]
  readonly y: number; // Yellow [0, 1]
  readonly k: number; // Key / Black [0, 1]
}

export interface RgbColor {
  readonly r: number; // Red [0, 1]
  readonly g: number; // Green [0, 1]
  readonly b: number; // Blue [0, 1]
}

/**
 * Standard Total Area Coverage (TAC) ink limits for press profiles.
 * Default is 300% (3.0 total coverage) for ISO 12647-2 (FOGRA39 / FOGRA51).
 */
export const DEFAULT_TAC_LIMIT = 3.0; // 300%

export const CMYK_BLACKS = {
  rich: { c: 0.6, m: 0.4, y: 0.3, k: 1.0 },
  warm: { c: 0.2, m: 0.6, y: 0.3, k: 1.0 },
  cool: { c: 0.7, m: 0.35, y: 0.1, k: 1.0 },
  pureK: { c: 0.0, m: 0.0, y: 0.0, k: 1.0 },
  standard: { c: 0.0, m: 0.0, y: 0.0, k: 1.0 },
} as const satisfies Record<string, CmykColor>;

/**
 * Converts normalized sRGB [0, 1] to DeviceCMYK [0, 1] with Under Color Removal (UCR)
 * and Total Area Coverage (TAC) ink limiting.
 */
export function rgbToCmyk(
  r: number,
  g: number,
  b: number,
  tacLimit = DEFAULT_TAC_LIMIT
): CmykColor {
  const safeR = Math.max(0, Math.min(1, r));
  const safeG = Math.max(0, Math.min(1, g));
  const safeB = Math.max(0, Math.min(1, b));

  // Pure black edge case
  if (safeR === 0 && safeG === 0 && safeB === 0) {
    return { c: 0, m: 0, y: 0, k: 1 };
  }

  // Pure white edge case
  if (safeR === 1 && safeG === 1 && safeB === 1) {
    return { c: 0, m: 0, y: 0, k: 0 };
  }

  const k = 1 - Math.max(safeR, safeG, safeB);
  const invK = 1 - k;

  let c = invK === 0 ? 0 : (1 - safeR - k) / invK;
  let m = invK === 0 ? 0 : (1 - safeG - k) / invK;
  let y = invK === 0 ? 0 : (1 - safeB - k) / invK;

  c = Math.max(0, Math.min(1, c));
  m = Math.max(0, Math.min(1, m));
  y = Math.max(0, Math.min(1, y));

  // Enforce Total Area Coverage (TAC) clamping
  const totalInk = c + m + y + k;
  if (totalInk > tacLimit) {
    const scale = (tacLimit - k) / (c + m + y || 1);
    c = Math.max(0, c * scale);
    m = Math.max(0, m * scale);
    y = Math.max(0, y * scale);
  }

  return { c, m, y, k };
}

/**
 * Converts a hex string ('#RRGGBB' or '#RGB') to DeviceCMYK.
 */
export function hexToCmyk(hex: string, tacLimit = DEFAULT_TAC_LIMIT): CmykColor {
  const clean = (hex || '#000000').replace('#', '').trim();
  let r = 0;
  let g = 0;
  let b = 0;

  if (clean.length === 3) {
    r = parseInt(clean[0]! + clean[0]!, 16) / 255;
    g = parseInt(clean[1]! + clean[1]!, 16) / 255;
    b = parseInt(clean[2]! + clean[2]!, 16) / 255;
  } else if (clean.length >= 6) {
    r = parseInt(clean.substring(0, 2), 16) / 255;
    g = parseInt(clean.substring(2, 4), 16) / 255;
    b = parseInt(clean.substring(4, 6), 16) / 255;
  }

  return rgbToCmyk(
    Number.isNaN(r) ? 0 : r,
    Number.isNaN(g) ? 0 : g,
    Number.isNaN(b) ? 0 : b,
    tacLimit
  );
}

/**
 * Converts DeviceCMYK [0, 1] back to sRGB [0, 1].
 */
export function cmykToRgb(cmyk: CmykColor): RgbColor {
  const invK = 1 - Math.max(0, Math.min(1, cmyk.k));
  const r = (1 - Math.max(0, Math.min(1, cmyk.c))) * invK;
  const g = (1 - Math.max(0, Math.min(1, cmyk.m))) * invK;
  const b = (1 - Math.max(0, Math.min(1, cmyk.y))) * invK;

  return {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b)),
  };
}

/**
 * Calculates the Total Area Coverage percentage (e.g. 300% for 3.0 total ink).
 */
export function calculateTotalAreaCoverage(cmyk: CmykColor): number {
  return Math.round((cmyk.c + cmyk.m + cmyk.y + cmyk.k) * 100);
}

/**
 * Formats a CMYK color into human-readable percentages (e.g. "C:60% M:40% Y:30% K:100%").
 */
export function formatCmykPercent(cmyk: CmykColor): string {
  const c = Math.round(cmyk.c * 100);
  const m = Math.round(cmyk.m * 100);
  const y = Math.round(cmyk.y * 100);
  const k = Math.round(cmyk.k * 100);
  return `C:${c}% M:${m}% Y:${y}% K:${k}%`;
}

/**
 * Formats a CMYK color into PostScript / PDF DeviceCMYK operator stream syntax.
 * Syntax: `c m y k k` (fill) or `c m y k K` (stroke).
 */
export function formatPdfDeviceCmyk(cmyk: CmykColor, operator: 'k' | 'K' = 'k'): string {
  const c = cmyk.c.toFixed(4);
  const m = cmyk.m.toFixed(4);
  const y = cmyk.y.toFixed(4);
  const k = cmyk.k.toFixed(4);
  return `${c} ${m} ${y} ${k} ${operator}`;
}
