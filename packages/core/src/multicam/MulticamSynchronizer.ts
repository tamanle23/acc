export interface CameraAngle {
  angleId: string;
  sourcePath: string;
  audioSamples: Float32Array;
  sampleRate: number;
}

export interface SynchronizedAngleResult {
  angleId: string;
  offsetMs: number;
  confidenceScore: number;
}

export class MulticamSynchronizer {
  public static calculateWaveformOffset(
    referenceSamples: Float32Array,
    targetSamples: Float32Array,
    sampleRate = 44100,
    maxOffsetSeconds = 10
  ): { offsetMs: number; confidenceScore: number } {
    const maxOffsetSamples = Math.round(maxOffsetSeconds * sampleRate);
    const searchLength = Math.min(referenceSamples.length, targetSamples.length);

    let maxCorrelation = -Infinity;
    let bestLag = 0;

    // Cross-correlation search window
    const step = 8; // Fine-grained search step for exact offset calculation
    for (let lag = -maxOffsetSamples; lag <= maxOffsetSamples; lag += step) {
      let sum = 0;
      let count = 0;

      for (let i = 0; i < searchLength; i += 4) {
        const targetIdx = i + lag;
        if (targetIdx >= 0 && targetIdx < targetSamples.length) {
          sum += referenceSamples[i] * targetSamples[targetIdx];
          count++;
        }
      }

      const correlation = count > 0 ? sum / count : 0;
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestLag = lag;
      }
    }

    const offsetMs = Math.round((bestLag / sampleRate) * 1000);
    const confidenceScore = Math.min(1.0, Math.max(0.0, maxCorrelation * 35));

    return { offsetMs, confidenceScore };
  }

  public static synchronizeAngles(
    referenceAngle: CameraAngle,
    targetAngles: CameraAngle[]
  ): SynchronizedAngleResult[] {
    return targetAngles.map(target => {
      const { offsetMs, confidenceScore } = this.calculateWaveformOffset(
        referenceAngle.audioSamples,
        target.audioSamples,
        referenceAngle.sampleRate
      );

      return {
        angleId: target.angleId,
        offsetMs,
        confidenceScore,
      };
    });
  }
}
