import { ContentCacheStrategyId, type IContentCacheStrategy, type CacheEntryMetadata } from '@acc/core-isomorphic';
import { fastChecksum } from '@acc/core-isomorphic';

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

/**
 * WebCacheStrategy:
 * Browser client cache strategy utilizing the standard Web Cache API (window.caches / self.caches).
 * Designed for Service Workers, Web Workers, and Browser environments to cache binary assets, frames,
 * and blobs with HTTP Response semantics.
 * Gracefully falls back to an in-memory Map in non-browser/SSR or test mock environments without window.caches.
 */
export class WebCacheStrategy implements IContentCacheStrategy {
  public readonly id = ContentCacheStrategyId.WebCache;
  public readonly name = 'Standard Web Cache API Content Cache';

  private readonly cacheName: string;
  private readonly baseUrlPrefix: string;
  private cachePromise: Promise<Cache | null> | null = null;
  private readonly fallbackMemory: Map<string, { data: Uint8Array; metadata: CacheEntryMetadata }> = new Map();

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
   * Retrieves the binary content associated with key.
   */
  public async get(key: string): Promise<Uint8Array | null> {
    const cache = await this.getCache();
    if (!cache) {
      const item = this.fallbackMemory.get(key);
      return item ? item.data : null;
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
      const headers = new Headers();
      headers.set('Content-Type', fullMeta.mimeType || 'application/octet-stream');
      headers.set('Content-Length', String(data.byteLength));
      headers.set(HEADER_CHECKSUM, fullMeta.checksum);
      headers.set(HEADER_CREATED_AT, String(fullMeta.createdAt));

      if (fullMeta.metadata) {
        try {
          headers.set(HEADER_META_JSON, JSON.stringify(fullMeta.metadata));
        } catch {
          // Ignore JSON serialization errors on metadata
        }
      }

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
