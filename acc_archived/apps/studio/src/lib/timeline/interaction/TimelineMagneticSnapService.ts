import type { HitTestTrack } from './TimelineHitTester';

export interface SnapTarget {
  frame: number;
  type: 'playhead' | 'clip-edge' | 'grid';
  label?: string;
}

export interface SnapResult {
  snappedFrame: number;
  isSnapped: boolean;
  target?: SnapTarget;
}

export class TimelineMagneticSnapService {
  public static readonly DEFAULT_SNAP_THRESHOLD_PX = 10;

  /**
   * Calculates the nearest magnetic snap frame given a candidate frame.
   */
  public static calculateSnap(
    candidateFrame: number,
    pixelsPerFrame: number,
    playheadFrame: number,
    tracks: HitTestTrack[],
    excludeSeqId?: string,
    snapThresholdPx: number = TimelineMagneticSnapService.DEFAULT_SNAP_THRESHOLD_PX
  ): SnapResult {
    const thresholdFrames = Math.max(1, Math.round(snapThresholdPx / pixelsPerFrame));

    let closestTarget: SnapTarget | null = null;
    let minDistance = Infinity;

    // 1. Check Playhead snap
    const distPlayhead = Math.abs(candidateFrame - playheadFrame);
    if (distPlayhead <= thresholdFrames && distPlayhead < minDistance) {
      minDistance = distPlayhead;
      closestTarget = { frame: playheadFrame, type: 'playhead', label: 'Playhead' };
    }

    // 2. Check Sequence boundaries across all tracks
    for (const track of tracks) {
      for (const seq of track.sequences) {
        if (excludeSeqId && seq.id === excludeSeqId) continue;

        const start = seq.startFrame ?? seq.timelineStartFrame ?? 0;
        const end = start + seq.durationFrames;

        const distStart = Math.abs(candidateFrame - start);
        if (distStart <= thresholdFrames && distStart < minDistance) {
          minDistance = distStart;
          closestTarget = { frame: start, type: 'clip-edge', label: `Clip Start (${start}f)` };
        }

        const distEnd = Math.abs(candidateFrame - end);
        if (distEnd <= thresholdFrames && distEnd < minDistance) {
          minDistance = distEnd;
          closestTarget = { frame: end, type: 'clip-edge', label: `Clip End (${end}f)` };
        }
      }
    }

    // 3. Check Major Timecode Grid (every 1 second)
    const fps = 30; // standard fallback
    const nearestSecFrame = Math.round(candidateFrame / fps) * fps;
    const distGrid = Math.abs(candidateFrame - nearestSecFrame);
    if (distGrid <= thresholdFrames && distGrid < minDistance) {
      minDistance = distGrid;
      closestTarget = { frame: nearestSecFrame, type: 'grid', label: `Grid (${nearestSecFrame}f)` };
    }

    if (closestTarget) {
      return {
        snappedFrame: closestTarget.frame,
        isSnapped: true,
        target: closestTarget,
      };
    }

    return {
      snappedFrame: candidateFrame,
      isSnapped: false,
    };
  }
}
