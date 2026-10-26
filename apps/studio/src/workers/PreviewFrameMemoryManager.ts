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
  private readonly MAX_GLOBAL_FRAMES = 64;

  // Key: `${assetId}:${frame}` -> CachedFrameEntry
  private frameMap = new Map<string, CachedFrameEntry>();

  // Staged disposal queue: frames evicted during prewarm/seek that must not be closed until current render completes
  private pendingDisposal: ImageBitmap[] = [];

  private constructor() {}

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
      entry.lastAccess = performance.now();
      return entry.bitmap;
    }
    return null;
  }

  public set(assetId: string, frame: number, bitmap: ImageBitmap): void {
    const key = `${assetId}:${frame}`;
    const existing = this.frameMap.get(key);
    if (existing && existing.bitmap !== bitmap) {
      this.stageForDisposal(existing.bitmap);
    }

    // Enforce global budget
    if (this.frameMap.size >= this.MAX_GLOBAL_FRAMES) {
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
   */
  public pruneOutsideWindow(playheadFrame: number, fps: number): void {
    const minFrame = Math.max(0, playheadFrame - Math.round(2 * fps));
    const maxFrame = playheadFrame + Math.round(3 * fps);

    for (const [key, entry] of this.frameMap) {
      if (entry.frame < minFrame || entry.frame > maxFrame) {
        this.frameMap.delete(key);
        this.stageForDisposal(entry.bitmap);
      }
    }
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.frameMap) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.frameMap.get(oldestKey);
      if (entry) {
        this.frameMap.delete(oldestKey);
        this.stageForDisposal(entry.bitmap);
      }
    }
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
