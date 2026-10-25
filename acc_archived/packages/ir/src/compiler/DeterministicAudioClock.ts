/**
 * Deterministic Audio Clock:
 * Implements Bresenham integer accumulation for fractional audio sample distribution.
 * Eliminates audio-video drift across arbitrary timeline lengths down to individual sample precision.
 */
export class DeterministicAudioClock {
  public static getAudioBoundsForFrame(
    frameIndex: number,
    sampleRate: number = 48000,
    fps: number = 30
  ): { startSample: number; sampleCount: number } {
    const exactStartSample = Math.round((frameIndex * sampleRate) / fps);
    const exactEndSample = Math.round(((frameIndex + 1) * sampleRate) / fps);

    return {
      startSample: exactStartSample,
      sampleCount: exactEndSample - exactStartSample,
    };
  }

  public static totalSamplesForFrames(
    totalFrames: number,
    sampleRate: number = 48000,
    fps: number = 30
  ): number {
    return Math.round((totalFrames * sampleRate) / fps);
  }
}
