import type { ResolvedTimeline, ResolvedSequence } from '../../types/VideoIR';
import { IntervalTreeIndex } from '../../compiler/IntervalTreeIndex';

export interface PreviewFrameResult {
  frame: number;
  timestampSeconds: number;
  activeSequences: ResolvedSequence[];
  renderScale: number;
  latencyMs: number;
}

/**
 * IRPreviewEngine:
 * Optimized engine for frontend visual video editors (preview mode).
 * Provides sub-16ms random-access playhead scrubbing, Level-of-Detail (LOD) downscaling,
 * and active layer interval-tree queries.
 */
export class IRPreviewEngine {
  private timeline: ResolvedTimeline;
  private intervalTree: IntervalTreeIndex;
  private currentScale: number = 1.0;

  constructor(timeline: ResolvedTimeline) {
    this.timeline = timeline;
    const allSequences = Array.from(timeline.sequences.values());
    this.intervalTree = new IntervalTreeIndex(allSequences);
  }

  /**
   * Set Level of Detail (LOD) for responsive scrubbing (e.g. 0.25x or 0.5x)
   */
  public setLODScale(scale: number): void {
    this.currentScale = Math.max(0.1, Math.min(1.0, scale));
  }

  /**
   * Random-access seek to arbitrary frame integer t.
   * Target latency: < 16ms (60 FPS interactive).
   */
  public seek(frame: number): PreviewFrameResult {
    const start = performance.now();
    const clampedFrame = Math.max(0, Math.min(this.timeline.totalFrames, Math.round(frame)));
    const activeSequences = this.intervalTree.queryActive(clampedFrame);

    const latencyMs = performance.now() - start;

    return {
      frame: clampedFrame,
      timestampSeconds: clampedFrame / this.timeline.meta.globalFps,
      activeSequences,
      renderScale: this.currentScale,
      latencyMs,
    };
  }
}
