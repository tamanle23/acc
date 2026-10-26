export interface SnapCandidate {
  frame: number;
  label?: string;
  isAbut?: boolean;
}

export interface SnapCalculationResult {
  snappedFrame: number;
  isSnapped: boolean;
  guidelineFrame: number | null;
  label: string | null;
  isAbut?: boolean;
}

export interface SnapOptions {
  targetStart: number;
  durationFrames: number;
  pixelsPerFrame: number;
  playheadFrame: number;
  tracks: Array<{
    id: string;
    sequences: Array<{
      id: string;
      startFrame?: number;
      timelineStartFrame?: number;
      durationFrames: number;
    }>;
  }>;
  excludeSeqIds?: string[];
  activeGuidelineFrame?: number | null;
  snapThresholdPx?: number;
  breakawayThresholdPx?: number;
}

/**
 * TimelineSnapCalculator:
 * Production-grade edge-to-edge magnetic snapping calculator with breakaway hysteresis.
 * Evaluates candidate clip abutment edges and the playhead needle within screen-space distance.
 * Implements breakaway force so sub-pixel mouse movement does not cause snapping jitter.
 */
export class TimelineSnapCalculator {
  public static readonly DEFAULT_SNAP_THRESHOLD_PX = 8;
  public static readonly DEFAULT_BREAKAWAY_THRESHOLD_PX = 6;

  public static calculateSnap(options: SnapOptions): SnapCalculationResult {
    const {
      targetStart,
      durationFrames,
      pixelsPerFrame,
      playheadFrame,
      tracks,
      excludeSeqIds = [],
      activeGuidelineFrame = null,
      snapThresholdPx = TimelineSnapCalculator.DEFAULT_SNAP_THRESHOLD_PX,
      breakawayThresholdPx = TimelineSnapCalculator.DEFAULT_BREAKAWAY_THRESHOLD_PX,
    } = options;

    const snapThresholdFrames = Math.max(1, Math.round(snapThresholdPx / pixelsPerFrame));
    const breakawayThresholdFrames = Math.max(1, Math.round(breakawayThresholdPx / pixelsPerFrame));

    // 1. If currently snapped, enforce breakaway hysteresis
    if (activeGuidelineFrame !== null) {
      const distFromGuideline = Math.min(
        Math.abs(targetStart - activeGuidelineFrame),
        Math.abs(targetStart + durationFrames - activeGuidelineFrame)
      );
      if (distFromGuideline <= breakawayThresholdFrames) {
        // Retain magnetic lock
        const isEndSnap = Math.abs(targetStart + durationFrames - activeGuidelineFrame) < Math.abs(targetStart - activeGuidelineFrame);
        return {
          snappedFrame: isEndSnap ? activeGuidelineFrame - durationFrames : activeGuidelineFrame,
          isSnapped: true,
          guidelineFrame: activeGuidelineFrame,
          label: null,
        };
      }
    }

    // 2. Gather candidates: Abutting sequence boundaries + Playhead
    const candidates: SnapCandidate[] = [{ frame: playheadFrame, label: 'Playhead' }];
    const excludeSet = new Set(excludeSeqIds);

    for (const track of tracks) {
      if (!Array.isArray(track.sequences)) continue;
      for (const seq of track.sequences) {
        if (excludeSet.has(seq.id)) continue;
        const sStart = seq.startFrame ?? seq.timelineStartFrame ?? 0;
        const sEnd = sStart + seq.durationFrames;
        candidates.push(
          { frame: sStart, label: `Abut ${seq.id}`, isAbut: true },
          { frame: sEnd, label: `Abut ${seq.id}`, isAbut: true }
        );
      }
    }

    // 3. Find closest candidate within screen-space threshold
    const targetEnd = targetStart + durationFrames;
    let closestCandidate: SnapCandidate | null = null;
    let closestDistance = Infinity;
    let snappedStart = targetStart;

    for (const pt of candidates) {
      const distStart = Math.abs(targetStart - pt.frame);
      if (distStart <= snapThresholdFrames && distStart < closestDistance) {
        closestDistance = distStart;
        closestCandidate = pt;
        snappedStart = pt.frame;
      }

      const distEnd = Math.abs(targetEnd - pt.frame);
      if (distEnd <= snapThresholdFrames && distEnd < closestDistance) {
        closestDistance = distEnd;
        closestCandidate = pt;
        snappedStart = pt.frame - durationFrames;
      }
    }

    if (closestCandidate) {
      return {
        snappedFrame: Math.max(0, snappedStart),
        isSnapped: true,
        guidelineFrame: closestCandidate.frame,
        label: closestCandidate.label || null,
        isAbut: closestCandidate.isAbut,
      };
    }

    return {
      snappedFrame: Math.max(0, targetStart),
      isSnapped: false,
      guidelineFrame: null,
      label: null,
    };
  }
}
