export interface TemporalCadenceOptions {
  timelineFrame: number;
  timelineFps: number;
  sequenceStartFrame: number;
  trimInSec?: number;
  speed?: number;
  sourceFps?: number;
}

export interface TemporalCadenceResult {
  targetMediaSec: number;
  sourceFrameIndex: number;
  shouldSeek: boolean;
  deltaSec: number;
}

/**
 * TemporalCadenceResolver:
 * Deterministically resolves timeline frame t to underlying media asset timestamps.
 * Enforces hybrid frame advance vs keyframe seek thresholds to prevent GOP seek thrashing.
 */
export class TemporalCadenceResolver {
  public static readonly FORWARD_STEP_MAX_DELTA_SEC = 0.25;
  public static readonly SEEK_MIN_FORWARD_DELTA_SEC = 0.50;

  public static resolve(
    options: TemporalCadenceOptions,
    currentMediaSec: number = -1
  ): TemporalCadenceResult {
    const timelineFps = options.timelineFps > 0 ? options.timelineFps : 30;
    const speed = typeof options.speed === 'number' && Number.isFinite(options.speed) ? options.speed : 1.0;
    const trimInSec = options.trimInSec ?? 0;
    const sourceFps = options.sourceFps && options.sourceFps > 0 ? options.sourceFps : timelineFps;

    const localFrame = Math.max(0, options.timelineFrame - options.sequenceStartFrame);
    const localSec = localFrame / timelineFps;
    const targetMediaSec = Math.max(0, trimInSec + localSec * speed);
    const sourceFrameIndex = Math.round(targetMediaSec * sourceFps);

    const deltaSec = currentMediaSec >= 0 ? targetMediaSec - currentMediaSec : 0;
    const shouldSeek = currentMediaSec < 0 || deltaSec < 0 || deltaSec > this.SEEK_MIN_FORWARD_DELTA_SEC;

    return {
      targetMediaSec,
      sourceFrameIndex,
      shouldSeek,
      deltaSec,
    };
  }
}
