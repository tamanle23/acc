/**
 * PreviewFrameMemoryManager:
 * Strict memory hygiene manager enforcing zero browser GPU memory leaks.
 *
 * Rules:
 * 1. Global Frame Budget: MAX_GLOBAL_FRAMES = 64 (~150MB RAM ceiling).
 * 2. Window-Bounded Eviction: Any frame outside [playhead - 2s, playhead + 3s] is evicted.
 * 3. Mandatory .close(): Every evicted ImageBitmap has .close() called synchronously.
 */
export interface CachedFrameEntry {
  assetId: string;
  frame: number;
  bitmap: ImageBitmap;
  lastAccess: number;
}

export class PreviewFrameMemoryManager {
  private static instance: PreviewFrameMemoryManager;
  private readonly MAX_GLOBAL_FRAMES = 8;

  // Key: `${assetId}:${frame}` -> CachedFrameEntry
  private frameMap = new Map<string, CachedFrameEntry>();

  // Staged disposal queue: retained for defensive compatibility
  private pendingDisposal: ImageBitmap[] = [];

  private constructor() { }

  public static getInstance(): PreviewFrameMemoryManager {
    if (!PreviewFrameMemoryManager.instance) {
      PreviewFrameMemoryManager.instance = new PreviewFrameMemoryManager();
    }
    return PreviewFrameMemoryManager.instance;
  }

  public get(assetId: string, frame: number): ImageBitmap | null {
    const key = `${assetId}:${frame}`;
    const entry = this.frameMap.get(key);
    if (entry) {
      // Refresh LRU order: delete and re-insert
      this.frameMap.delete(key);
      entry.lastAccess = performance.now();
      this.frameMap.set(key, entry);
      return entry.bitmap;
    }
    return null;
  }

  public set(assetId: string, frame: number, bitmap: ImageBitmap): void {
    const key = `${assetId}:${frame}`;
    const existing = this.frameMap.get(key);

    if (existing) {
      if (existing.bitmap !== bitmap) {
        // Synchronously close overwritten bitmap immediately
        this.closeBitmap(existing.bitmap);
      }
      this.frameMap.delete(key);
    } else if (this.frameMap.size >= this.MAX_GLOBAL_FRAMES) {
      this.evictLeastRecentlyUsed();
    }

    this.frameMap.set(key, {
      assetId,
      frame,
      bitmap,
      lastAccess: performance.now(),
    });
  }

  /**
   * Enforces window-bounded eviction: discard frames outside [playhead - 2s, playhead + 3s].
   * When a timeline is provided, resolves clip-local frame boundaries per active sequence.
   * All discarded bitmaps are synchronously and immediately closed.
   */
  public pruneOutsideWindow(playheadFrame: number, fps: number, timeline?: any): void {
    if (timeline && timeline.tracks) {
      // Build active local frame windows per assetId
      const activeAssetWindows = new Map<string, Array<{ minLocal: number; maxLocal: number }>>();
      const windowLookaheadFrames = Math.round(3 * fps);
      const windowLookbehindFrames = Math.round(2 * fps);

      for (const track of timeline.tracks.values()) {
        if (track.type !== 'video' && track.type !== 'image' && track.type !== 'overlay') {
          continue;
        }
        for (const seq of track.sequences) {
          if (!seq.assetId) continue;
          const seqStart = seq.startFrame ?? 0;
          const seqEnd = seqStart + (seq.durationFrames ?? 0);

          // Check if sequence intersects [playhead - 2s, playhead + 3s]
          if (seqEnd >= playheadFrame - windowLookbehindFrames && seqStart <= playheadFrame + windowLookaheadFrames) {
            const minLocal = Math.max(0, playheadFrame - seqStart - windowLookbehindFrames);
            const maxLocal = playheadFrame - seqStart + windowLookaheadFrames;

            const existing = activeAssetWindows.get(seq.assetId) || [];
            existing.push({ minLocal, maxLocal });
            activeAssetWindows.set(seq.assetId, existing);
          }
        }
      }

      for (const [key, entry] of this.frameMap) {
        const windows = activeAssetWindows.get(entry.assetId);
        if (!windows || windows.length === 0) {
          // Asset is no longer anywhere near the playhead - prune immediately
          this.frameMap.delete(key);
          this.closeBitmap(entry.bitmap);
          continue;
        }

        // Check if entry.frame falls within at least one valid local window
        const inWindow = windows.some((w) => entry.frame >= w.minLocal && entry.frame <= w.maxLocal);
        if (!inWindow) {
          this.frameMap.delete(key);
          this.closeBitmap(entry.bitmap);
        }
      }
      return;
    }

    const minFrame = Math.max(0, playheadFrame - Math.round(2 * fps));
    const maxFrame = playheadFrame + Math.round(3 * fps);

    for (const [key, entry] of this.frameMap) {
      if (entry.frame < minFrame || entry.frame > maxFrame) {
        this.frameMap.delete(key);
        this.closeBitmap(entry.bitmap);
      }
    }
  }

  /**
   * Removes and returns a frame without closing it, transferring ownership to the caller
   * (e.g. for marking as single-use transient playback frame).
   */
  public take(assetId: string, frame: number): ImageBitmap | null {
    const key = `${assetId}:${frame}`;
    const entry = this.frameMap.get(key);
    if (entry) {
      this.frameMap.delete(key);
      return entry.bitmap;
    }
    return null;
  }

  private evictLeastRecentlyUsed(): void {
    // With insertion-order Map and get() re-inserting, first key is oldest LRU
    const oldestKey = this.frameMap.keys().next().value;
    if (oldestKey !== undefined) {
      const entry = this.frameMap.get(oldestKey);
      this.frameMap.delete(oldestKey);
      if (entry) {
        this.closeBitmap(entry.bitmap);
      }
    }
  }

  public delete(assetId: string, frame: number): boolean {
    const key = `${assetId}:${frame}`;
    const entry = this.frameMap.get(key);
    if (entry) {
      this.frameMap.delete(key);
      this.closeBitmap(entry.bitmap);
      return true;
    }
    return false;
  }

  private stageForDisposal(bitmap: ImageBitmap): void {
    if (bitmap && !this.pendingDisposal.includes(bitmap)) {
      this.pendingDisposal.push(bitmap);
    }
  }

  /**
   * Post-Render Drain: synchronously closes evicted bitmaps after canvas draw passes finish.
   * Any bitmap currently in `protectedBitmaps` (actively used by the active frame render) is retained.
   */
  public drainDisposalQueue(protectedBitmaps?: Set<ImageBitmap>): void {
    if (this.pendingDisposal.length === 0) return;

    const remaining: ImageBitmap[] = [];
    for (const bmp of this.pendingDisposal) {
      if (protectedBitmaps && protectedBitmaps.has(bmp)) {
        remaining.push(bmp);
      } else {
        this.closeBitmap(bmp);
      }
    }
    this.pendingDisposal = remaining;
  }

  private closeBitmap(bitmap: ImageBitmap): void {
    try {
      if (typeof bitmap.close === 'function') {
        bitmap.close();
      }
    } catch (err) {
      // Invariant: ignore disposal errors if already closed
    }
  }

  public getPendingDisposalCount(): number {
    return this.pendingDisposal.length;
  }

  public size(): number {
    return this.frameMap.size;
  }

  public clear(): void {
    for (const [, entry] of this.frameMap) {
      this.closeBitmap(entry.bitmap);
    }
    this.frameMap.clear();

    for (const bmp of this.pendingDisposal) {
      this.closeBitmap(bmp);
    }
    this.pendingDisposal = [];
  }
}
