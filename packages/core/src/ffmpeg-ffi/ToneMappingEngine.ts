export interface ToneMappingOptions {
  inputColorSpace?: 'rec2020' | 'hlg' | 'hdr10';
  targetColorSpace?: 'rec709';
  algorithm?: 'hable' | 'mobius' | 'reinhard';
}

export class ToneMappingEngine {
  public static generateFFmpegToneMapFilter(options: ToneMappingOptions = {}): string {
    const algorithm = options.algorithm || 'hable';
    return `zscale=transfer=linear,tonemap=${algorithm}:desat=0.0,zscale=transfer=bt709:matrix=bt709:primaries=bt709`;
  }
}
