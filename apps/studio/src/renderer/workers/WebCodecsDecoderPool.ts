import type { MediabunnyWorkerReader } from './MediabunnyWorkerReader';

export interface DecoderPoolItem {
  assetId: string;
  reader: MediabunnyWorkerReader;
  priorityScore: number;
  lastUsedTimestamp: number;
  isLeased: boolean;
}

export interface PriorityEvaluationContext {
  playheadFrame: number;
  fps: number;
  activeAssetIds?: Set<string>;
  mutedTrackIds?: Set<string>;
  timeline?: {
    sequences: Map<string, any>;
    tracks?: Map<string, any>;
  };
}

/**
 * WebCodecsDecoderPool:
 * Centralized hardware video decoder lease pool for WebCodecs.
 * Enforces a strict ceiling (default <= 8) on concurrent hardware VideoDecoder instances
 * to prevent browser GPU driver quota crashes (QuotaExceededError) across multi-track timelines.
 * Implements playhead proximity priority scoring, idle eviction, and automatic quota recovery.
 */
export class WebCodecsDecoderPool {
  private static instance: WebCodecsDecoderPool | null = null;
  private maxHardwareDecoders: number = 8;
  private pool = new Map<string, DecoderPoolItem>();

  public static getInstance(): WebCodecsDecoderPool {
    if (!WebCodecsDecoderPool.instance) {
      WebCodecsDecoderPool.instance = new WebCodecsDecoderPool();
    }
    return WebCodecsDecoderPool.instance;
  }

  public setMaxHardwareDecoders(limit: number): void {
    this.maxHardwareDecoders = Math.max(1, limit);
    this.enforceQuota();
  }

  public getMaxHardwareDecoders(): number {
    return this.maxHardwareDecoders;
  }

  public register(assetId: string, reader: MediabunnyWorkerReader): void {
    if (this.pool.has(assetId)) {
      const item = this.pool.get(assetId)!;
      item.reader = reader;
      return;
    }

    this.pool.set(assetId, {
      assetId,
      reader,
      priorityScore: 0,
      lastUsedTimestamp: performance.now(),
      isLeased: reader.getIsInitialized(),
    });

    this.enforceQuota();
  }

  public unregister(assetId: string): void {
    const item = this.pool.get(assetId);
    if (item) {
      if (item.isLeased) {
        item.reader.evictHardwareDecoder();
      }
      this.pool.delete(assetId);
    }
  }

  public getItem(assetId: string): DecoderPoolItem | undefined {
    return this.pool.get(assetId);
  }

  public async acquireLease(assetId: string, minPriority = 0): Promise<boolean> {
    let item = this.pool.get(assetId);
    if (!item) return false;

    item.lastUsedTimestamp = performance.now();
    if (item.isLeased && item.reader.getIsInitialized()) {
      return true;
    }

    const leasedCount = this.getActiveLeaseCount();
    if (leasedCount >= this.maxHardwareDecoders) {
      const evicted = this.evictLowestPriority(Math.max(item.priorityScore, minPriority));
      if (!evicted) {
        return false;
      }
    }

    try {
      const ok = await item.reader.reacquireHardwareDecoder();
      item.isLeased = ok;
      return ok;
    } catch (err: unknown) {
      const errorMsg = String(err);
      if (errorMsg.includes('QuotaExceededError') || errorMsg.includes('quota')) {
        this.handleQuotaExceeded(assetId);
      }
      item.isLeased = false;
      return false;
    }
  }

  public releaseLease(assetId: string): void {
    const item = this.pool.get(assetId);
    if (item && item.isLeased) {
      item.reader.evictHardwareDecoder();
      item.isLeased = false;
    }
  }

  public getActiveLeaseCount(): number {
    let count = 0;
    for (const item of this.pool.values()) {
      if (item.isLeased && item.reader.getIsInitialized()) {
        count++;
      }
    }
    return count;
  }

  public updatePriorities(ctx: PriorityEvaluationContext): void {
    const { playheadFrame, fps, timeline, activeAssetIds, mutedTrackIds } = ctx;

    for (const item of this.pool.values()) {
      let score = 0;

      // 1. Actively visible assets at the playhead receive top priority
      if (activeAssetIds && activeAssetIds.has(item.assetId)) {
        score = 10000;
      } else if (timeline && timeline.sequences) {
        let bestDistance = Infinity;
        let isMuted = false;

        for (const seq of timeline.sequences.values()) {
          if (seq.assetId === item.assetId) {
            if (mutedTrackIds && seq.trackId && mutedTrackIds.has(seq.trackId)) {
              isMuted = true;
              continue;
            }

            const start = seq.startFrame ?? 0;
            const end = start + (seq.durationFrames ?? 0);
            if (playheadFrame >= start && playheadFrame <= end) {
              bestDistance = 0;
              break;
            }
            const dist = playheadFrame < start ? start - playheadFrame : playheadFrame - end;
            if (dist < bestDistance) {
              bestDistance = dist;
            }
          }
        }

        if (isMuted && bestDistance === Infinity) {
          score = 0;
        } else if (bestDistance === 0) {
          score = 10000;
        } else if (bestDistance < fps * 3) {
          score = Math.max(100, Math.floor(1000 - (bestDistance / fps) * 50));
        } else if (bestDistance < fps * 10) {
          score = 50;
        }
      }

      item.priorityScore = score;
    }

    this.enforceQuota();
  }

  public enforceQuota(): void {
    const leased = Array.from(this.pool.values())
      .filter((i) => i.isLeased && i.reader.getIsInitialized())
      .sort((a, b) => b.priorityScore - a.priorityScore || b.lastUsedTimestamp - a.lastUsedTimestamp);

    while (leased.length > this.maxHardwareDecoders) {
      const toEvict = leased.pop();
      if (toEvict) {
        toEvict.reader.evictHardwareDecoder();
        toEvict.isLeased = false;
      }
    }
  }

  private evictLowestPriority(incomingPriority: number): boolean {
    const leased = Array.from(this.pool.values())
      .filter((i) => i.isLeased && i.reader.getIsInitialized())
      .sort((a, b) => a.priorityScore - b.priorityScore || a.lastUsedTimestamp - b.lastUsedTimestamp);

    if (leased.length === 0) return false;

    const lowest = leased[0]!;
    if (lowest.priorityScore <= incomingPriority) {
      lowest.reader.evictHardwareDecoder();
      lowest.isLeased = false;
      return true;
    }

    return false;
  }

  public handleQuotaExceeded(failingAssetId?: string): void {
    console.warn(`[WebCodecsDecoderPool] QuotaExceededError triggered. Reducing max decoders from ${this.maxHardwareDecoders}`);
    this.maxHardwareDecoders = Math.max(2, this.maxHardwareDecoders - 2);
    this.enforceQuota();
  }

  public clear(): void {
    for (const item of this.pool.values()) {
      if (item.isLeased) {
        item.reader.evictHardwareDecoder();
        item.isLeased = false;
      }
    }
    this.pool.clear();
  }

  public getPoolSize(): number {
    return this.pool.size;
  }
}
