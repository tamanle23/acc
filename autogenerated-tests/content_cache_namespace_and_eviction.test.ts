import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ContentCacheRegistry,
  CacheNamespace,
  type IContentCacheStrategy,
  type CachePayload,
  type CacheEntryMetadata,
} from '../packages/core-isomorphic/src/cache';

class MockCacheStrategy implements IContentCacheStrategy {
  public readonly id = 'mock-memory';
  public readonly name = 'Mock In-Memory Cache';
  private storage = new Map<string, Blob>();
  private metadataStorage = new Map<string, CacheEntryMetadata>();

  public async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  public async get(key: string): Promise<Blob | null> {
    return this.storage.get(key) || null;
  }

  public async set(key: string, data: CachePayload, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    const blob = data instanceof Blob ? data : new Blob([data as any]);
    this.storage.set(key, blob);
    if (metadata) {
      this.metadataStorage.set(key, {
        checksum: metadata.checksum || key,
        createdAt: metadata.createdAt || Date.now(),
        lastAccessedAt: metadata.lastAccessedAt || Date.now(),
        expiresAt: metadata.expiresAt,
        sizeBytes: metadata.sizeBytes || blob.size,
        namespace: metadata.namespace || 'default',
        metadata: metadata.metadata,
      });
    }
  }

  public async getMetadata(key: string): Promise<CacheEntryMetadata | null> {
    return this.metadataStorage.get(key) || null;
  }

  public async delete(key: string): Promise<boolean> {
    const had = this.storage.has(key);
    this.storage.delete(key);
    this.metadataStorage.delete(key);
    return had;
  }

  public async clear(): Promise<void> {
    this.storage.clear();
    this.metadataStorage.clear();
  }

  public async getKeys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}

describe('ContentCacheRegistry Namespaces, TTL & Eviction Suite', () => {
  let mockStrategy: MockCacheStrategy;

  beforeEach(() => {
    ContentCacheRegistry.reset();
    mockStrategy = new MockCacheStrategy();
    ContentCacheRegistry.register(mockStrategy, true);
  });

  it('strictly isolates keys between different namespaces', async () => {
    const assetCache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
    const textureCache = ContentCacheRegistry.namespace(CacheNamespace.Textures);

    await assetCache.set('item-1', 'asset-content');
    await textureCache.set('item-1', 'texture-content');

    expect(await assetCache.has('item-1')).toBe(true);
    expect(await textureCache.has('item-1')).toBe(true);

    const assetBlob = await assetCache.get('item-1');
    const textureBlob = await textureCache.get('item-1');

    expect(await assetBlob?.text()).toBe('asset-content');
    expect(await textureBlob?.text()).toBe('texture-content');

    const assetKeys = await assetCache.getKeys();
    const textureKeys = await textureCache.getKeys();

    expect(assetKeys).toEqual(['item-1']);
    expect(textureKeys).toEqual(['item-1']);

    // Deleting in assetCache does not affect textureCache
    await assetCache.delete('item-1');
    expect(await assetCache.has('item-1')).toBe(false);
    expect(await textureCache.has('item-1')).toBe(true);
  });

  it('expires entries on get() when TTL is exceeded', async () => {
    const tempCache = ContentCacheRegistry.namespace(CacheNamespace.Temp);

    await tempCache.set('short-lived', 'temporary-data', { ttlMs: 25 });
    expect(await tempCache.has('short-lived')).toBe(true);

    // Wait for expiration
    await new Promise((res) => setTimeout(res, 35));

    expect(await tempCache.has('short-lived')).toBe(false);
    expect(await tempCache.get('short-lived')).toBeNull();
  });

  it('bulk evicts expired entries using evictExpired()', async () => {
    const tempCache = ContentCacheRegistry.namespace(CacheNamespace.Temp);

    await tempCache.set('key-1', 'expiring-soon', { ttlMs: 20 });
    await tempCache.set('key-2', 'long-lived', { ttlMs: 10000 });

    await new Promise((res) => setTimeout(res, 30));

    const evictedCount = await tempCache.evictExpired();
    expect(evictedCount).toBe(1);

    expect(await tempCache.has('key-1')).toBe(false);
    expect(await tempCache.has('key-2')).toBe(true);
  });

  it('evicts entries based on LRU policy when exceeding maxEntries', async () => {
    const audioCache = ContentCacheRegistry.namespace(CacheNamespace.Audio);

    await audioCache.set('track-1', 'audio-data-1', { sizeBytes: 100 });
    await audioCache.set('track-2', 'audio-data-2', { sizeBytes: 100 });
    await audioCache.set('track-3', 'audio-data-3', { sizeBytes: 100 });

    // Access track-1 so track-2 becomes the least recently used
    await new Promise((r) => setTimeout(r, 10));
    await audioCache.get('track-1');

    // Evict down to max 2 entries
    const evicted = await audioCache.evict({ maxEntries: 2, strategy: 'lru' });
    expect(evicted).toBe(1);

    expect(await audioCache.has('track-1')).toBe(true);
    expect(await audioCache.has('track-3')).toBe(true);
    expect(await audioCache.has('track-2')).toBe(false);
  });

  it('evicts entries based on maxSizeBytes quota', async () => {
    const vfxCache = ContentCacheRegistry.namespace(CacheNamespace.VFX);

    await vfxCache.set('map-1', 'a'.repeat(200), { sizeBytes: 200 });
    await vfxCache.set('map-2', 'b'.repeat(200), { sizeBytes: 200 });
    await vfxCache.set('map-3', 'c'.repeat(200), { sizeBytes: 200 });

    // Max quota is 300 bytes -> must evict oldest until <= 300 bytes (pruning 2 entries)
    const evicted = await vfxCache.evict({ maxSizeBytes: 300 });
    expect(evicted).toBe(2);

    expect(await vfxCache.has('map-3')).toBe(true);
    expect(await vfxCache.has('map-1')).toBe(false);
    expect(await vfxCache.has('map-2')).toBe(false);
  });
});
