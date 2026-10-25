export interface ToneMappingOptions {
  inputColorSpace?: 'rec2020' | 'hlg' | 'hdr10';
  targetColorSpace?: 'rec709';
  algorithm?: 'hable' | 'mobius' | 'reinhard' | 'bt2390';
  peakLuminanceNits?: number;
  desaturation?: number;
}

export class ToneMappingEngine {
  /**
   * Generates FFmpeg HDR-to-SDR tone mapping filter graph adhering to ITU-R BT.2390 standards.
   */
  public static generateFFmpegToneMapFilter(options: ToneMappingOptions = {}): string {
    const algorithm = options.algorithm || 'bt2390';
    const desat = options.desaturation ?? 0.0;
    const peak = options.peakLuminanceNits ?? 1000;

    if (algorithm === 'bt2390') {
      return `zscale=transfer=linear:npl=${peak},tonemap=tonemap=bt2390:desat=${desat.toFixed(1)},zscale=transfer=bt709:matrix=bt709:primaries=bt709`;
    }

    return `zscale=transfer=linear,tonemap=${algorithm}:desat=${desat.toFixed(1)},zscale=transfer=bt709:matrix=bt709:primaries=bt709`;
  }
}
