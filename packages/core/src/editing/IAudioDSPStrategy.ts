export interface AudioDSPParams {
  gainDb?: number;
  sampleRate?: number;
}

export interface IAudioDSPStrategy {
  readonly id: string;
  processAudioBuffer(samples: Float32Array, params?: AudioDSPParams): Float32Array;
  generateFFmpegFilterGraph(params?: AudioDSPParams): string;
}

export class GainNormalizeAudioDSP implements IAudioDSPStrategy {
  public readonly id = 'gain_normalize';

  public processAudioBuffer(samples: Float32Array, params?: AudioDSPParams): Float32Array {
    const gainDb = params?.gainDb ?? 0;
    const factor = Math.pow(10, gainDb / 20);
    const result = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      result[i] = Math.max(-1.0, Math.min(1.0, samples[i] * factor));
    }
    return result;
  }

  public generateFFmpegFilterGraph(params?: AudioDSPParams): string {
    const gainDb = params?.gainDb ?? 0;
    return `volume=${gainDb.toFixed(1)}dB`;
  }
}
