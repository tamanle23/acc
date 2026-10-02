export interface VoiceIsolationOptions {
  highpassHz?: number; // e.g. 80Hz
  lowpassHz?: number; // e.g. 12000Hz
  noiseSuppressionDb?: number; // e.g. -21dB
}

export class VoiceIsolationEngine {
  public static generateFFmpegVoiceIsolationFilter(options: VoiceIsolationOptions = {}): string {
    const highpass = options.highpassHz ?? 80;
    const lowpass = options.lowpassHz ?? 12000;
    const suppression = options.noiseSuppressionDb ?? -21;

    return `highpass=f=${highpass},lowpass=f=${lowpass},afftdn=nr=${Math.abs(suppression)}`;
  }
}
