import type { IVideoDecoder, IMediaEngineStrategy } from '@acc/core-isomorphic';

export interface DecoderPoolItem {
  assetId: string;
  resolvedPath: string;
  decoder: IVideoDecoder;
  lastUsedTimestamp: number;
  priorityScore: number;
}

/**
 * BoundedDecoderPool:
 * Centralized hardware video decoder lease pool for timeline export and rendering.
 *
 * Strict Invariants:
 * - HARDWARE DECODER BOUND: Strict ceiling (default <= 4) on concurrent hardware VideoDecoder instances.
 *   Guarantees zero browser GPU driver quota crashes (QuotaExceededError).
 * - JIT LEASE ACQUISITION: Decoders are opened just-in-time as their timeline sequences become active.
 * - PRIORITY EVICTION: Evicts lowest-priority and LRU decoders when concurrent track demand exceeds capacity.
 */
export class BoundedDecoderPool {
  private activeDecoders = new Map<string, DecoderPoolItem>();
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 4) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  public getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  public getActiveCount(): number {
    return this.activeDecoders.size;
  }

  public has(assetId: string): boolean {
    return this.activeDecoders.has(assetId);
  }

  public get(assetId: string): IVideoDecoder | undefined {
    const item = this.activeDecoders.get(assetId);
    if (item) {
      item.lastUsedTimestamp = performance.now();
      return item.decoder;
    }
    return undefined;
  }

  /**
   * Acquires a decoder for an asset. If active decoders exceed maxConcurrent,
   * evicts the lowest-priority / least-recently-used decoder.
   */
  public async acquire(
    assetId: string,
    resolvedPath: string,
    width: number,
    height: number,
    strategy: IMediaEngineStrategy,
    priorityScore = 0
  ): Promise<IVideoDecoder | null> {
    const existing = this.activeDecoders.get(assetId);
    if (existing) {
      existing.lastUsedTimestamp = performance.now();
      existing.priorityScore = priorityScore;
      return existing.decoder;
    }

    // Enforce quota: evict lowest priority or LRU if quota reached
    if (this.activeDecoders.size >= this.maxConcurrent) {
      this.evictLowestPriority(priorityScore);
    }

    if (this.activeDecoders.size >= this.maxConcurrent) {
      return null;
    }

    if (!strategy || typeof strategy.createVideoDecoder !== 'function') {
      return null;
    }

    try {
      const decoder = strategy.createVideoDecoder(resolvedPath, width, height);
      if (await decoder.open()) {
        this.activeDecoders.set(assetId, {
          assetId,
          resolvedPath,
          decoder,
          lastUsedTimestamp: performance.now(),
          priorityScore,
        });
        return decoder;
      }
    } catch {
      // Failed to open
    }

    return null;
  }

  private evictLowestPriority(currentPriority: number): boolean {
    let candidateKey: string | null = null;
    let lowestScore = Infinity;
    let oldestTimestamp = Infinity;

    for (const [key, item] of this.activeDecoders.entries()) {
      if (item.priorityScore < lowestScore) {
        lowestScore = item.priorityScore;
        oldestTimestamp = item.lastUsedTimestamp;
        candidateKey = key;
      } else if (item.priorityScore === lowestScore && item.lastUsedTimestamp < oldestTimestamp) {
        oldestTimestamp = item.lastUsedTimestamp;
        candidateKey = key;
      }
    }

    if (candidateKey) {
      this.release(candidateKey);
      return true;
    }

    return false;
  }

  public release(assetId: string): void {
    const item = this.activeDecoders.get(assetId);
    if (item) {
      this.activeDecoders.delete(assetId);
      try {
        item.decoder.close();
      } catch {}
    }
  }

  public releaseInactive(activeAssetIds: Set<string>): void {
    for (const [key] of this.activeDecoders) {
      if (!activeAssetIds.has(key)) {
        this.release(key);
      }
    }
  }

  public closeAll(): void {
    for (const item of this.activeDecoders.values()) {
      try {
        item.decoder.close();
      } catch {}
    }
    this.activeDecoders.clear();
  }
}
