export interface FreezeFrameOptions {
  freezeAtMs: number;
  durationMs: number;
}

export class FreezeFrameStrategy {
  public static generateFFmpegFreezeFrameFilter(options: FreezeFrameOptions): string {
    const freezeSec = (options.freezeAtMs / 1000).toFixed(2);
    const durationSec = (options.durationMs / 1000).toFixed(2);
    return `loop=loop=-1:size=1:start=trunc(${freezeSec}*fps),trim=duration=${durationSec}`;
  }
}
