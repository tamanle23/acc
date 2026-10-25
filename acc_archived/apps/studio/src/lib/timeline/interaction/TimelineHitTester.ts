export interface HitTestTrack {
  id: string;
  type?: string;
  sequences: Array<{
    id: string;
    startFrame?: number;
    timelineStartFrame?: number;
    durationFrames: number;
    type?: string;
  }>;
}

export interface TimelineHitTestResult {
  type: 'clip' | 'trim-start' | 'trim-end' | 'empty-track' | 'none';
  seqId?: string;
  seq?: HitTestTrack['sequences'][0];
  trackId?: string;
  trackIndex?: number;
  frame?: number;
}

export class TimelineHitTester {
  public static readonly TRIM_HANDLE_WIDTH = 10; // pixels (ergonomic hit area)

  /**
   * Evaluates hit-test for a point on the timeline canvas.
   * @param localPoint Point relative to timeline track area (excluding sticky header).
   * @param scrollLeft Current horizontal scroll in pixels.
   * @param scrollTop Current vertical scroll in pixels.
   * @param pixelsPerFrame Zoom scale.
   * @param rowHeight Height per track row in pixels (default: 44).
   * @param tracks List of active timeline tracks.
   */
  public static hitTest(
    localPoint: { x: number; y: number },
    scrollLeft: number,
    scrollTop: number,
    pixelsPerFrame: number,
    rowHeight: number = 44,
    tracks: HitTestTrack[] = []
  ): TimelineHitTestResult {
    const worldX = localPoint.x + scrollLeft;
    const worldY = localPoint.y + scrollTop;
    const currentFrame = Math.max(0, Math.floor(worldX / pixelsPerFrame));

    if (worldY < 0 || tracks.length === 0) {
      return { type: 'none', frame: currentFrame };
    }

    const trackIndex = Math.floor(worldY / rowHeight);
    if (trackIndex < 0 || trackIndex >= tracks.length) {
      return { type: 'none', frame: currentFrame };
    }

    const track = tracks[trackIndex];
    const trackY = trackIndex * rowHeight;
    // Check vertical margin within track row (rowHeight - 4)
    if (worldY < trackY + 2 || worldY > trackY + rowHeight - 2) {
      return { type: 'empty-track', trackId: track.id, trackIndex, frame: currentFrame };
    }

    // Check sequences in track
    for (const seq of track.sequences) {
      const startFrame = seq.startFrame ?? seq.timelineStartFrame ?? 0;
      const endFrame = startFrame + seq.durationFrames;

      const clipLeftPx = startFrame * pixelsPerFrame;
      const clipRightPx = endFrame * pixelsPerFrame;

      if (worldX >= clipLeftPx && worldX <= clipRightPx) {
        // Hit inside clip! Check for trim handles
        if (worldX - clipLeftPx <= TimelineHitTester.TRIM_HANDLE_WIDTH) {
          return {
            type: 'trim-start',
            seqId: seq.id,
            seq,
            trackId: track.id,
            trackIndex,
            frame: currentFrame,
          };
        }

        if (clipRightPx - worldX <= TimelineHitTester.TRIM_HANDLE_WIDTH) {
          return {
            type: 'trim-end',
            seqId: seq.id,
            seq,
            trackId: track.id,
            trackIndex,
            frame: currentFrame,
          };
        }

        return {
          type: 'clip',
          seqId: seq.id,
          seq,
          trackId: track.id,
          trackIndex,
          frame: currentFrame,
        };
      }
    }

    return {
      type: 'empty-track',
      trackId: track.id,
      trackIndex,
      frame: currentFrame,
    };
  }
}
