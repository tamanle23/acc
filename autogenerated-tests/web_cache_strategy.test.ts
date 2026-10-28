import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  WebCacheStrategy,
  type WebCacheOptions,
} from '../packages/core-web/src/cache/WebCacheStrategy';
import {
  ContentCacheRegistry,
  streamToUint8Array,
  uint8ArrayToStream,
} from '@acc/core-isomorphic';

describe('WebCacheStrategy (Standard Web Cache API Strategy Pattern)', () => {
  beforeEach(() => {
    ContentCacheRegistry.reset();
  });

  describe('Fallback Memory Mode (SSR/Node/Bun without window.caches)', () => {
    it('initializes with default identifier and options', () => {
      const strategy = new WebCacheStrategy();
      expect(strategy.id).toBe('web-cache');
      expect(strategy.name).toBe('Standard Web Cache API Content Cache');
    });

    it('performs CRUD operations correctly using fallback memory', async () => {
      const strategy = new WebCacheStrategy();
      const payload = new Uint8Array([1, 2, 3, 4, 5]);

      expect(await strategy.has('blob/item-1')).toBe(false);
      expect(await strategy.get('blob/item-1')).toBeNull();

      await strategy.set('blob/item-1', payload, {
        mimeType: 'application/octet-stream',
        metadata: { tag: 'unit-test' },
      });

      expect(await strategy.has('blob/item-1')).toBe(true);
      const retrieved = await strategy.get('blob/item-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved).toEqual(payload);

      const keys = await strategy.getKeys();
      expect(keys).toContain('blob/item-1');

      const deleted = await strategy.delete('blob/item-1');
      expect(deleted).toBe(true);
      expect(await strategy.has('blob/item-1')).toBe(false);
      expect(await strategy.get('blob/item-1')).toBeNull();
    });

    it('clears all cached entries in memory mode', async () => {
      const strategy = new WebCacheStrategy();
      await strategy.set('key-a', new Uint8Array([10]));
      await strategy.set('key-b', new Uint8Array([20]));

      expect((await strategy.getKeys()).length).toBe(2);
      await strategy.clear();
      expect(await strategy.get('key-a')).toBeNull();
    });

    it('supports Blob and ReadableStream operations in fallback memory mode', async () => {
      const strategy = new WebCacheStrategy();
      const blob = new Blob(['fallback-stream-test'], { type: 'text/plain' });

      await strategy.setBlob('blob-fallback', blob, {
        mimeType: 'text/plain',
        metadata: { source: 'unit-test' },
      });

      expect(await strategy.has('blob-fallback')).toBe(true);

      const retrievedBlob = await strategy.getBlob('blob-fallback');
      expect(retrievedBlob).not.toBeNull();
      expect(await retrievedBlob!.text()).toBe('fallback-stream-test');

      const meta = await strategy.getMetadata('blob-fallback');
      expect(meta).not.toBeNull();
      expect(meta?.sizeBytes).toBe(blob.size);

      // Stream retrieval
      const stream = await strategy.getStream('blob-fallback');
      expect(stream).not.toBeNull();
      const bytes = await streamToUint8Array(stream!);
      expect(new TextDecoder().decode(bytes)).toBe('fallback-stream-test');

      // Stream set
      const writeStream = uint8ArrayToStream(new TextEncoder().encode('streaming-data'));
      await strategy.setStream('stream-key', writeStream, { mimeType: 'text/plain' });
      const streamRes = await strategy.getStream('stream-key');
      expect(streamRes).not.toBeNull();
      const readBackBytes = await streamToUint8Array(streamRes!);
      expect(new TextDecoder().decode(readBackBytes)).toBe('streaming-data');
    });
  });

  describe('Simulated Standard Web Cache API Environment (window.caches / caches)', () => {
    let mockCacheStore: Map<string, Response>;
    let mockCacheInstance: Cache;
    let originalCaches: typeof globalThis.caches;

    beforeEach(() => {
      mockCacheStore = new Map();
      mockCacheInstance = {
        match: async (request: RequestInfo | URL) => {
          const url = typeof request === 'string' ? request : (request as Request).url;
          const res = mockCacheStore.get(url);
          return res ? res.clone() : undefined;
        },
        put: async (request: RequestInfo | URL, response: Response) => {
          const url = typeof request === 'string' ? request : (request as Request).url;
          mockCacheStore.set(url, response.clone());
        },
        delete: async (request: RequestInfo | URL) => {
          const url = typeof request === 'string' ? request : (request as Request).url;
          return mockCacheStore.delete(url);
        },
        keys: async () => {
          return Array.from(mockCacheStore.keys()).map((url) => new Request(url));
        },
      } as unknown as Cache;

      originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;

      (globalThis as unknown as { caches: CacheStorage }).caches = {
        open: async (_cacheName: string) => mockCacheInstance,
        has: async (_cacheName: string) => true,
        delete: async (_cacheName: string) => {
          mockCacheStore.clear();
          return true;
        },
        keys: async () => ['acc_content_cache'],
        match: async () => undefined,
      } as unknown as CacheStorage;
    });

    afterEach(() => {
      if (originalCaches !== undefined) {
        (globalThis as unknown as { caches: CacheStorage }).caches = originalCaches;
      } else {
        delete (globalThis as unknown as { caches?: CacheStorage }).caches;
      }
    });

    it('interacts with standard Cache API storing Responses and reading ArrayBuffers', async () => {
      const strategy = new WebCacheStrategy({
        cacheName: 'test_web_cache',
        baseUrlPrefix: 'https://cdn.example.com/assets',
      });

      const binaryData = new Uint8Array([100, 101, 102, 103, 104]);
      await strategy.set('model/v1/weights.bin', binaryData, {
        mimeType: 'application/octet-stream',
        metadata: { model: 'detector', version: 1 },
      });

      expect(await strategy.has('model/v1/weights.bin')).toBe(true);
      expect(await strategy.has('model/unknown')).toBe(false);

      const retrieved = await strategy.get('model/v1/weights.bin');
      expect(retrieved).not.toBeNull();
      expect(retrieved).toEqual(binaryData);

      // Verify that the underlying mock cache stored a Response with headers
      const expectedUrl = 'https://cdn.example.com/assets/model%2Fv1%2Fweights.bin';
      const cachedResponse = mockCacheStore.get(expectedUrl);
      expect(cachedResponse).toBeDefined();
      expect(cachedResponse?.headers.get('Content-Type')).toBe('application/octet-stream');
      expect(cachedResponse?.headers.get('x-acc-checksum')).toBeDefined();
      expect(cachedResponse?.headers.get('x-acc-meta-json')).toBe(JSON.stringify({ model: 'detector', version: 1 }));

      const keys = await strategy.getKeys();
      expect(keys).toEqual(['model/v1/weights.bin']);

      const deleted = await strategy.delete('model/v1/weights.bin');
      expect(deleted).toBe(true);
      expect(await strategy.has('model/v1/weights.bin')).toBe(false);
      expect(await strategy.get('model/v1/weights.bin')).toBeNull();
    });

    it('clears CacheStorage via delete(cacheName)', async () => {
      const strategy = new WebCacheStrategy();
      await strategy.set('frame-001', new Uint8Array([1, 2, 3]));
      await strategy.set('frame-002', new Uint8Array([4, 5, 6]));

      expect((await strategy.getKeys()).length).toBe(2);

      await strategy.clear();
      expect((await strategy.getKeys()).length).toBe(0);
      expect(await strategy.has('frame-001')).toBe(false);
    });

    it('supports Blob and ReadableStream operations with CacheStorage', async () => {
      const strategy = new WebCacheStrategy();
      const blob = new Blob(['cache-storage-stream-test'], { type: 'text/plain' });

      await strategy.setBlob('blob-cache-key', blob, {
        mimeType: 'text/plain',
        metadata: { streamable: true },
      });

      expect(await strategy.has('blob-cache-key')).toBe(true);

      const retrievedBlob = await strategy.getBlob('blob-cache-key');
      expect(retrievedBlob).not.toBeNull();
      expect(await retrievedBlob!.text()).toBe('cache-storage-stream-test');

      const meta = await strategy.getMetadata('blob-cache-key');
      expect(meta).not.toBeNull();
      expect(meta?.sizeBytes).toBe(blob.size);

      // Stream retrieval directly from Response.body
      const stream = await strategy.getStream('blob-cache-key');
      expect(stream).not.toBeNull();
      const bytes = await streamToUint8Array(stream!);
      expect(new TextDecoder().decode(bytes)).toBe('cache-storage-stream-test');

      // Stream set
      const writeStream = uint8ArrayToStream(new TextEncoder().encode('cached-stream-payload'));
      await strategy.setStream('stream-target', writeStream, { mimeType: 'text/plain' });
      const streamRes = await strategy.getStream('stream-target');
      expect(streamRes).not.toBeNull();
      const readBackBytes = await streamToUint8Array(streamRes!);
      expect(new TextDecoder().decode(readBackBytes)).toBe('cached-stream-payload');
    });

    it('registers and retrieves from ContentCacheRegistry as IContentCacheStrategy', () => {
      const strategy = new WebCacheStrategy();
      ContentCacheRegistry.register(strategy, true);

      expect(ContentCacheRegistry.has('web-cache')).toBe(true);
      expect(ContentCacheRegistry.get().id).toBe('web-cache');
      expect(ContentCacheRegistry.get('web-cache')).toBe(strategy);
    });
  });
});
