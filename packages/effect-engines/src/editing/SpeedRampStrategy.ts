import type { Keyframe } from '@acc/ir';

export class SpeedRampStrategy {
  public static evaluateSpeedAtTime(keyframes: Keyframe<number>[], timeMs: number): number {
    if (keyframes.length === 0) return 1.0;
    if (timeMs <= keyframes[0].timeMs) return keyframes[0].value;
    if (timeMs >= keyframes[keyframes.length - 1].timeMs) return keyframes[keyframes.length - 1].value;

    for (let i = 0; i < keyframes.length - 1; i++) {
      const k1 = keyframes[i];
      const k2 = keyframes[i + 1];

      if (timeMs >= k1.timeMs && timeMs <= k2.timeMs) {
        const progress = (timeMs - k1.timeMs) / (k2.timeMs - k1.timeMs);
        // Smooth Hermite cubic interpolation
        const smoothProgress = progress * progress * (3 - 2 * progress);
        return k1.value + smoothProgress * (k2.value - k1.value);
      }
    }

    return 1.0;
  }

  public static generateFFmpegSetPtsFilter(speedMultiplier: number): string {
    const ptsRatio = (1.0 / speedMultiplier).toFixed(3);
    return `setpts=${ptsRatio}*PTS`;
  }
}
