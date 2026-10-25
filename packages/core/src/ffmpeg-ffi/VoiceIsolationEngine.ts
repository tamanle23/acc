export interface VoiceIsolationOptions {
  highpassHz?: number; // e.g. 80Hz
  lowpassHz?: number; // e.g. 12000Hz
  noiseSuppressionDb?: number; // e.g. -21dB
  strategy?: 'spectral' | 'rnnoise' | 'demucs_ai';
  modelPath?: string;
}

export class VoiceIsolationEngine {
  /**
   * Generates FFmpeg audio filter graph for vocal isolation and deep noise suppression.
   */
  public static generateFFmpegVoiceIsolationFilter(options: VoiceIsolationOptions = {}): string {
    const highpass = options.highpassHz ?? 80;
    const lowpass = options.lowpassHz ?? 12000;
    const suppression = options.noiseSuppressionDb ?? -21;
    const strategy = options.strategy ?? 'spectral';

    switch (strategy) {
      case 'rnnoise': {
        const model = options.modelPath ? `:m=${options.modelPath}` : '';
        return `highpass=f=${highpass},arnndn${model},lowpass=f=${lowpass}`;
      }
      case 'demucs_ai': {
        return `ai_demucs=stem=vocals:highpass=${highpass}:lowpass=${lowpass}`;
      }
      case 'spectral':
      default: {
        return `highpass=f=${highpass},lowpass=f=${lowpass},afftdn=nr=${Math.abs(suppression)}`;
      }
    }
  }
}
