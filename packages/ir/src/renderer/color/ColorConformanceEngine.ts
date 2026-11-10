/**
 * ColorConformanceEngine:
 * Color space transformation and HDR-to-SDR tone-mapping engine.
 * Supports:
 * - Rec.2020 (Wide Color Gamut) to Rec.709 (SDR) linear gamut mapping matrix.
 * - ACES Filmic Tone Mapping (Narkowicz 2015 formulation) for natural highlight roll-off.
 * - Reinhard Extended Tone Mapping.
 * - Zero-CPU CSS filter approximations for real-time preview playback.
 */
export class ColorConformanceEngine {
  /**
   * Rec.2020 to Rec.709 linear 3x3 transformation matrix.
   */
  public static readonly REC2020_TO_REC709_MATRIX = [
    [1.6605, -0.5876, -0.0728],
    [-0.1246, 1.1329, -0.0083],
    [-0.0182, -0.1006, 1.1187],
  ] as const;

  /**
   * Evaluates ACES Filmic tone mapping curve on a single linear luminance/channel value x >= 0.
   * Compresses unbounded HDR range [0, infinity) smoothly into [0, 1].
   */
  public static evaluateACESFilmic(x: number): number {
    if (x <= 0) return 0;
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;
    const val = (x * (a * x + b)) / (x * (c * x + d) + e);
    return Math.max(0, Math.min(1.0, val));
  }

  /**
   * Evaluates Reinhard Extended tone mapping curve.
   */
  public static evaluateReinhard(x: number, whitePoint: number = 3.0): number {
    if (x <= 0) return 0;
    const whiteSq = whitePoint * whitePoint;
    const val = (x * (1 + x / whiteSq)) / (1 + x);
    return Math.max(0, Math.min(1.0, val));
  }

  /**
   * Converts Rec.2020 linear RGB to Rec.709 linear RGB.
   */
  public static convertRec2020ToRec709(r: number, g: number, b: number): [number, number, number] {
    const M = ColorConformanceEngine.REC2020_TO_REC709_MATRIX;
    const outR = M[0][0] * r + M[0][1] * g + M[0][2] * b;
    const outG = M[1][0] * r + M[1][1] * g + M[1][2] * b;
    const outB = M[2][0] * r + M[2][1] * g + M[2][2] * b;
    return [outR, outG, outB];
  }

  /**
   * Generates a GPU-accelerated CSS filter string for real-time 60fps 2D Canvas preview,
   * avoiding main-thread getImageData/putImageData stalls.
   */
  public static getPreviewCssFilter(sourceTransfer?: string): string {
    if (!sourceTransfer || sourceTransfer === 'srgb' || sourceTransfer === 'rec709') {
      return 'none';
    }
    if (sourceTransfer === 'hlg' || sourceTransfer === 'pq' || sourceTransfer === 'hdr') {
      // Soft S-curve contrast and saturation compensation for HDR preview on SDR display
      return 'contrast(1.12) saturate(1.08) brightness(0.96)';
    }
    if (sourceTransfer === 'slog3' || sourceTransfer === 'clog' || sourceTransfer === 'log') {
      // De-log contrast curve boost
      return 'contrast(1.45) saturate(1.25) brightness(0.92)';
    }
    return 'none';
  }

  /**
   * Applies offline ACES tone mapping directly across an in-memory 8-bit RGBA pixel buffer.
   */
  public static tonemapRgbaBufferInPlace(
    buffer: Uint8Array | Uint8ClampedArray,
    mode: 'aces' | 'reinhard' = 'aces',
    applyRec709Gamut = false
  ): void {
    const len = buffer.length;
    for (let i = 0; i < len; i += 4) {
      let r = buffer[i] / 255.0;
      let g = buffer[i + 1] / 255.0;
      let b = buffer[i + 2] / 255.0;

      if (applyRec709Gamut) {
        [r, g, b] = ColorConformanceEngine.convertRec2020ToRec709(r, g, b);
      }

      if (mode === 'aces') {
        r = ColorConformanceEngine.evaluateACESFilmic(r);
        g = ColorConformanceEngine.evaluateACESFilmic(g);
        b = ColorConformanceEngine.evaluateACESFilmic(b);
      } else {
        r = ColorConformanceEngine.evaluateReinhard(r);
        g = ColorConformanceEngine.evaluateReinhard(g);
        b = ColorConformanceEngine.evaluateReinhard(b);
      }

      buffer[i] = Math.round(r * 255.0);
      buffer[i + 1] = Math.round(g * 255.0);
      buffer[i + 2] = Math.round(b * 255.0);
    }
  }
}
