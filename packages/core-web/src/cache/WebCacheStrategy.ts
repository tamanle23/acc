import {
  ContentCacheStrategyId,
  type IContentCacheStrategy,
  type CacheEntryMetadata,
  fastChecksum,
  streamToBlob,
  blobToStream,
  uint8ArrayToStream,
  blobToUint8Array,
} from '@acc/core-isomorphic';

export interface WebCacheOptions {
  /**
   * The name of the cache namespace in CacheStorage.
   * Defaults to 'acc_content_cache'.
   */
  cacheName?: string;
  /**
   * Base URL scheme/prefix to construct valid Request URLs from keys.
   * Keys are mapped to URL: `${baseUrlPrefix}/${encodeURIComponent(key)}`.
   * Defaults to 'https://acc.internal/cache/'.
   */
  baseUrlPrefix?: string;
}

const DEFAULT_CACHE_NAME = 'acc_content_cache';
const DEFAULT_URL_PREFIX = 'https://acc.internal/cache';

const HEADER_CHECKSUM = 'x-acc-checksum';
const HEADER_CREATED_AT = 'x-acc-created-at';
const HEADER_META_JSON = 'x-acc-meta-json';

interface FallbackMemoryItem {
  data?: Uint8Array;
  blob?: Blob;
  metadata: CacheEntryMetadata;
}

/**
 * WebCacheStrategy:
 * Browser client cache strategy utilizing the standard Web Cache API (window.caches / self.caches).
 * Designed for Service Workers, Web Workers, and Browser environments to cache binary assets, frames,
 * and blobs with HTTP Response streaming semantics.
 * Gracefully falls back to an in-memory Map in non-browser/SSR or test mock environments without window.caches.
 */
export class WebCacheStrategy implements IContentCacheStrategy {
  public readonly id = ContentCacheStrategyId.WebCache;
  public readonly name = 'Standard Web Cache API Content Cache';

  private readonly cacheName: string;
  private readonly baseUrlPrefix: string;
  private cachePromise: Promise<Cache | null> | null = null;
  private readonly fallbackMemory: Map<string, FallbackMemoryItem> = new Map();

  constructor(options: WebCacheOptions = {}) {
    this.cacheName = options.cacheName || DEFAULT_CACHE_NAME;
    this.baseUrlPrefix = (options.baseUrlPrefix || DEFAULT_URL_PREFIX).replace(/\/+$/, '');
  }

  /**
   * Resolve Request URL from key.
   */
  private getRequestUrl(key: string): string {
    return `${this.baseUrlPrefix}/${encodeURIComponent(key)}`;
  }

  /**
   * Extract or open CacheStorage instance.
   */
  private getCacheStorage(): CacheStorage | null {
    if (typeof caches !== 'undefined') {
      return caches;
    }
    if (typeof window !== 'undefined' && window.caches) {
      return window.caches;
    }
    if (typeof self !== 'undefined' && self.caches) {
      return self.caches;
    }
    return null;
  }

  /**
   * Asynchronously access the Cache object.
   */
  private getCache(): Promise<Cache | null> {
    const storage = this.getCacheStorage();
    if (!storage) {
      return Promise.resolve(null);
    }

    if (!this.cachePromise) {
      this.cachePromise = storage.open(this.cacheName).catch(() => null);
    }

    return this.cachePromise;
  }

  /**
   * Checks whether the given key exists in the cache.
   */
  public async has(key: string): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) {
      return this.fallbackMemory.has(key);
    }

    try {
      const url = this.getRequestUrl(key);
      const match = await cache.match(url);
      return match !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the binary content associated with key as Uint8Array (backward compatibility).
   */
  public async get(key: string): Promise<Uint8Array | null> {
    const cache = await this.getCache();
    if (!cache) {
      const item = this.fallbackMemory.get(key);
      if (!item) return null;
      if (item.data) return item.data;
      if (item.blob) return await blobToUint8Array(item.blob);
      return null;
    }

    try {
      const url = this.getRequestUrl(key);
      const res = await cache.match(url);
      if (!res) {
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch {
      return null;
    }
  }

  /**
   * Retrieves the cached content directly as a Web standard Blob.
   * Zero heap Uint8Array allocation.
   */
  public async getBlob(key: string): Promise<Blob | null> {
    const cache = await this.getCache();
    if (!cache) {
      const item = this.fallbackMemory.get(key);
      if (!item) return null;
      if (item.blob) return item.blob;
      if (item.data) {
        return new Blob([item.data], { type: item.metadata.mimeType || 'application/octet-stream' });
      }
      return null;
    }

    try {
      const url = this.getRequestUrl(key);
      const res = await cache.match(url);
      if (!res) return null;
      return await res.blob();
    } catch {
      return null;
    }
  }

  /**
   * Retrieves the cached content as a WHATWG ReadableStream<Uint8Array>.
   * Enables zero-copy streaming directly from the browser's HTTP cache.
   */
  public async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const cache = await this.getCache();
    if (!cache) {
      const item = this.fallbackMemory.get(key);
      if (!item) return null;
      if (item.blob) return blobToStream(item.blob);
      if (item.data) return uint8ArrayToStream(item.data);
      return null;
    }

    try {
      const url = this.getRequestUrl(key);
      const res = await cache.match(url);
      if (!res || !res.body) return null;
      return res.body;
    } catch {
      return null;
    }
  }

  /**
   * Stores binary data and its metadata in Web Cache.
   */
  public async set(key: string, data: Uint8Array, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || fastChecksum(data),
      mimeType: metadata?.mimeType || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: data.byteLength,
      metadata: metadata?.metadata,
    };

    const cache = await this.getCache();
    if (!cache) {
      this.fallbackMemory.set(key, { data, metadata: fullMeta });
      return;
    }

    try {
      const url = this.getRequestUrl(key);
      const headers = this.buildHeaders(fullMeta, data.byteLength);

      // Create a cloned buffer slice to prevent detached buffer mutations
      const safeBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const response = new Response(safeBuffer, {
        status: 200,
        statusText: 'OK',
        headers,
      });

      await cache.put(url, response);
    } catch (err) {
      // Fallback gracefully to memory if quota exceeded or storage error
      this.fallbackMemory.set(key, { data, metadata: fullMeta });
    }
  }

  /**
   * Stores a Web standard Blob directly into Web Cache without array buffer conversion.
   */
  public async setBlob(key: string, blob: Blob, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || `blob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      mimeType: metadata?.mimeType || blob.type || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: blob.size,
      metadata: metadata?.metadata,
    };

    const cache = await this.getCache();
    if (!cache) {
      this.fallbackMemory.set(key, { blob, metadata: fullMeta });
      return;
    }

    try {
      const url = this.getRequestUrl(key);
      const headers = this.buildHeaders(fullMeta, blob.size);
      const response = new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers,
      });
      await cache.put(url, response);
    } catch {
      this.fallbackMemory.set(key, { blob, metadata: fullMeta });
    }
  }

  /**
   * Stores a ReadableStream directly into Web Cache.
   */
  public async setStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<void> {
    const mimeType = metadata?.mimeType || 'application/octet-stream';
    const blob = await streamToBlob(stream, mimeType);
    await this.setBlob(key, blob, metadata);
  }

  /**
   * Retrieves entry metadata without loading payload into memory.
   */
  public async getMetadata(key: string): Promise<CacheEntryMetadata | null> {
    const cache = await this.getCache();
    if (!cache) {
      const item = this.fallbackMemory.get(key);
      return item ? item.metadata : null;
    }

    try {
      const url = this.getRequestUrl(key);
      const res = await cache.match(url);
      if (!res) return null;

      const checksum = res.headers.get(HEADER_CHECKSUM) || '';
      const createdAt = Number(res.headers.get(HEADER_CREATED_AT) || Date.now());
      const mimeType = res.headers.get('Content-Type') || 'application/octet-stream';
      const sizeBytes = Number(res.headers.get('Content-Length') || 0);
      const metaHeader = res.headers.get(HEADER_META_JSON);
      let metadata: Record<string, unknown> | undefined;
      if (metaHeader) {
        try {
          metadata = JSON.parse(metaHeader);
        } catch {}
      }

      return {
        checksum,
        createdAt,
        mimeType,
        sizeBytes,
        metadata,
      };
    } catch {
      return null;
    }
  }

  private buildHeaders(meta: CacheEntryMetadata, length: number): Headers {
    const headers = new Headers();
    headers.set('Content-Type', meta.mimeType || 'application/octet-stream');
    headers.set('Content-Length', String(length));
    headers.set(HEADER_CHECKSUM, meta.checksum);
    headers.set(HEADER_CREATED_AT, String(meta.createdAt));

    if (meta.metadata) {
      try {
        headers.set(HEADER_META_JSON, JSON.stringify(meta.metadata));
      } catch {
        // Ignore JSON serialization errors on metadata
      }
    }
    return headers;
  }

  /**
   * Deletes a cached entry by key.
   */
  public async delete(key: string): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) {
      return this.fallbackMemory.delete(key);
    }

    try {
      const url = this.getRequestUrl(key);
      return await cache.delete(url);
    } catch {
      return false;
    }
  }

  /**
   * Clears all cache entries in this cache storage.
   */
  public async clear(): Promise<void> {
    const cache = await this.getCache();
    if (!cache) {
      this.fallbackMemory.clear();
      return;
    }

    try {
      const storage = this.getCacheStorage();
      if (storage) {
        await storage.delete(this.cacheName);
        this.cachePromise = null;
      } else {
        const keys = await cache.keys();
        await Promise.all(keys.map((req) => cache.delete(req)));
      }
    } catch {
      // Best-effort clear
    } finally {
      this.fallbackMemory.clear();
    }
  }

  /**
   * Retrieves all cached keys.
   */
  public async getKeys(): Promise<string[]> {
    const cache = await this.getCache();
    if (!cache) {
      return Array.from(this.fallbackMemory.keys());
    }

    try {
      const requests = await cache.keys();
      const prefix = `${this.baseUrlPrefix}/`;
      return requests.map((req) => {
        const url = req.url;
        if (url.startsWith(prefix)) {
          return decodeURIComponent(url.slice(prefix.length));
        }
        const lastSlash = url.lastIndexOf('/');
        return lastSlash >= 0 ? decodeURIComponent(url.slice(lastSlash + 1)) : url;
      });
    } catch {
      return [];
    }
  }
}
