import type { ResolvedTimeline, ResolvedSequence } from '@acc/ir';
import type { MediabunnyWorkerReader } from './MediabunnyWorkerReader';
import { PreviewFrameMemoryManager } from './PreviewFrameMemoryManager';

/**
 * WorkerClipPrewarmer:
 * Lookahead scheduler running in the Web Worker.
 *
 * Scans [currentFrame, currentFrame + 1.5s] across the timeline interval tree:
 * 1. Discovers upcoming clips before their start timestamps.
 * 2. Pre-initializes their MediabunnyWorkerReader if needed.
 * 3. Pre-decodes frame 0 (hero frame) into PreviewFrameMemoryManager.
 *
 * Result: When playhead crosses a clip transition, the frame is already hot in cache,
 * eliminating cut stutter and placeholder flashes.
 */
export class WorkerClipPrewarmer {
  private timeline: ResolvedTimeline | null = null;
  private readers: Map<string, MediabunnyWorkerReader>;
  private memoryManager = PreviewFrameMemoryManager.getInstance();
  private warmedSequences = new Set<string>();

  constructor(readers: Map<string, MediabunnyWorkerReader>) {
    this.readers = readers;
  }

  public setTimeline(timeline: ResolvedTimeline): void {
    this.timeline = timeline;
    this.warmedSequences.clear();
  }

  /**
   * Scans ahead 1.5s from current playhead frame.
   */
  public prewarmUpcomingClips(currentFrame: number, fps: number): void {
    if (!this.timeline) return;

    const lookaheadFrames = Math.round(1.5 * fps);
    const windowEnd = currentFrame + lookaheadFrames;

    // Prune memory outside [playhead - 2s, playhead + 3s]
    this.memoryManager.pruneOutsideWindow(currentFrame, fps);

    for (const track of this.timeline.tracks.values()) {
      if (track.type !== 'video' && track.type !== 'image' && track.type !== 'overlay') {
        continue;
      }

      for (const seq of track.sequences) {
        // Check if clip starts in the lookahead window [currentFrame, windowEnd]
        if (seq.startFrame >= currentFrame && seq.startFrame <= windowEnd) {
          if (!this.warmedSequences.has(seq.id)) {
            this.warmedSequences.add(seq.id);
            this.prewarmSequence(seq, fps);
          }
        }
      }
    }
  }

  private async prewarmSequence(seq: ResolvedSequence, fps: number): Promise<void> {
    if (!seq.assetId) return;

    // Check if already in memory (local frame 0 for sequence asset)
    const existing = this.memoryManager.get(seq.assetId, 0);
    if (existing) return;

    const reader = this.readers.get(seq.assetId);
    if (!reader) return;

    try {
      const bmp = await reader.requestFrame(0, fps, false);
      if (bmp) {
        this.memoryManager.set(seq.assetId, 0, bmp);
      }
    } catch {
      // Graceful pre-warm failure
    }
  }

  public reset(): void {
    this.warmedSequences.clear();
  }
}
