export interface BeatTimestamp {
  timestampMs: number;
  intensity: number;
}

export class MontageBeatSync {
  public static calculateBeatCuts(
    beatTimestamps: BeatTimestamp[],
    clipSourcePaths: string[],
    maxClipDurationMs = 1200
  ): Array<{ clipPath: string; startMs: number; durationMs: number }> {
    const cuts: Array<{ clipPath: string; startMs: number; durationMs: number }> = [];
    if (beatTimestamps.length === 0 || clipSourcePaths.length === 0) return cuts;

    let prevTimeMs = 0;
    let clipIndex = 0;

    for (let b = 0; b < beatTimestamps.length; b++) {
      const beat = beatTimestamps[b];
      const durationMs = beat.timestampMs - prevTimeMs;

      if (durationMs > 200 && durationMs <= maxClipDurationMs) {
        const clipPath = clipSourcePaths[clipIndex % clipSourcePaths.length];
        cuts.push({
          clipPath,
          startMs: prevTimeMs,
          durationMs,
        });
        clipIndex++;
        prevTimeMs = beat.timestampMs;
      }
    }

    return cuts;
  }
}
