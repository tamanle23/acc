import { ContentCacheStrategyId, type IContentCacheStrategy, type CacheEntryMetadata } from './types';
import { fastChecksum } from './fastChecksum';
import {
  uint8ArrayToStream,
  blobToStream,
  streamToBlob,
  blobToUint8Array,
  computeStreamChecksumAndSize,
} from './streamUtils';

interface MemoryCacheRecord {
  data?: Uint8Array;
  blob?: Blob;
  metadata: CacheEntryMetadata;
}

export interface MemoryCacheOptions {
  maxItems?: number;
  maxSizeBytes?: number; // Maximum total cached bytes ceiling (default: 64MB)
}

/**
 * MemoryCacheStrategy:
 * High-performance, zero-dependency in-memory cache strategy with LRU/FIFO eviction ceiling.
 * Features first-class Blob and Streaming API support.
 * Compatible with Node, Bun, Browser DOM, and Web Worker environments.
 */
export class MemoryCacheStrategy implements IContentCacheStrategy {
  public readonly id = ContentCacheStrategyId.Memory;
  public readonly name = 'In-Memory Content Cache';

  private cache: Map<string, MemoryCacheRecord> = new Map();
  private maxItems: number;
  private maxSizeBytes: number;
  private currentSizeBytes: number = 0;

  constructor(optionsOrMaxItems: number | MemoryCacheOptions = 100) {
    if (typeof optionsOrMaxItems === 'number') {
      this.maxItems = optionsOrMaxItems;
      this.maxSizeBytes = 64 * 1024 * 1024; // 64 MB default
    } else {
      this.maxItems = optionsOrMaxItems.maxItems ?? 100;
      this.maxSizeBytes = optionsOrMaxItems.maxSizeBytes ?? 64 * 1024 * 1024;
    }
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

    if (record.data) {
      return record.data;
    }
    if (record.blob) {
      return await blobToUint8Array(record.blob);
    }
    return null;
  }

  public async set(key: string, data: Uint8Array, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    const itemSize = data.byteLength;
    this.evictToFit(key, itemSize);

    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || fastChecksum(data),
      mimeType: metadata?.mimeType || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: itemSize,
      metadata: metadata?.metadata,
    };

    this.cache.set(key, { data, metadata: fullMeta });
    this.currentSizeBytes += itemSize;
  }

  public async getBlob(key: string): Promise<Blob | null> {
    const record = this.cache.get(key);
    if (!record) return null;

    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, record);

    if (record.blob) {
      return record.blob;
    }
    if (record.data) {
      return new Blob([record.data], { type: record.metadata.mimeType || 'application/octet-stream' });
    }
    return null;
  }

  public async setBlob(key: string, blob: Blob, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    const itemSize = blob.size;
    this.evictToFit(key, itemSize);

    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || `blob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      mimeType: metadata?.mimeType || blob.type || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: itemSize,
      metadata: metadata?.metadata,
    };

    this.cache.set(key, { blob, metadata: fullMeta });
    this.currentSizeBytes += itemSize;
  }

  public async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const record = this.cache.get(key);
    if (!record) return null;

    if (record.blob) {
      return blobToStream(record.blob);
    }
    if (record.data) {
      return uint8ArrayToStream(record.data);
    }
    return null;
  }

  public async setStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<void> {
    let finalStream = stream;
    let checksum = metadata?.checksum;
    let sizeBytes = metadata?.sizeBytes;

    if (!checksum || sizeBytes === undefined) {
      const computed = await computeStreamChecksumAndSize(stream);
      checksum = computed.checksum;
      sizeBytes = computed.sizeBytes;
      finalStream = computed.stream;
    }

    const mimeType = metadata?.mimeType || 'application/octet-stream';
    const blob = await streamToBlob(finalStream, mimeType);
    await this.setBlob(key, blob, {
      ...metadata,
      checksum,
      sizeBytes,
      mimeType,
    });
  }

  public async getMetadata(key: string): Promise<CacheEntryMetadata | null> {
    const record = this.cache.get(key);
    return record ? record.metadata : null;
  }

  public async delete(key: string): Promise<boolean> {
    const record = this.cache.get(key);
    if (record) {
      this.currentSizeBytes -= record.metadata.sizeBytes || 0;
      return this.cache.delete(key);
    }
    return false;
  }

  public async clear(): Promise<void> {
    this.cache.clear();
    this.currentSizeBytes = 0;
  }

  public async getKeys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  public getCurrentSizeBytes(): number {
    return this.currentSizeBytes;
  }

  private evictToFit(key: string, requiredBytes: number): void {
    // If key already exists, subtract its size first
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSizeBytes -= existing.metadata.sizeBytes || 0;
      this.cache.delete(key);
    }

    // Evict oldest entries until within maxItems and maxSizeBytes
    while (
      this.cache.size > 0 &&
      (this.cache.size >= this.maxItems || this.currentSizeBytes + requiredBytes > this.maxSizeBytes)
    ) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      const record = this.cache.get(oldestKey);
      if (record) {
        this.currentSizeBytes -= record.metadata.sizeBytes || 0;
      }
      this.cache.delete(oldestKey);
    }
  }
}
