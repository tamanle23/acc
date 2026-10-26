import { ContentCacheStrategyId, type IContentCacheStrategy, type CacheEntryMetadata } from './types';
import { fastChecksum } from './fastChecksum';

interface MemoryCacheRecord {
  data: Uint8Array;
  metadata: CacheEntryMetadata;
}

/**
 * MemoryCacheStrategy:
 * High-performance, zero-dependency in-memory cache strategy with LRU/FIFO eviction ceiling.
 * Compatible with Node, Bun, Browser DOM, and Web Worker environments.
 */
export class MemoryCacheStrategy implements IContentCacheStrategy {
  public readonly id = ContentCacheStrategyId.Memory;
  public readonly name = 'In-Memory Content Cache';

  private cache: Map<string, MemoryCacheRecord> = new Map();
  private maxItems: number;

  constructor(maxItems: number = 100) {
    this.maxItems = maxItems;
  }

  public async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  public async get(key: string): Promise<Uint8Array | null> {
    const record = this.cache.get(key);
    if (!record) return null;

    // Refresh LRU order on hit
    this.cache.delete(key);
    this.cache.set(key, record);
    return record.data;
  }

  public async set(key: string, data: Uint8Array, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    // If cache reached capacity, evict oldest entry (LRU)
    if (this.cache.size >= this.maxItems && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || fastChecksum(data),
      mimeType: metadata?.mimeType || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: data.byteLength,
      metadata: metadata?.metadata,
    };

    this.cache.set(key, { data, metadata: fullMeta });
  }

  public async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  public async clear(): Promise<void> {
    this.cache.clear();
  }

  public async getKeys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }
}
