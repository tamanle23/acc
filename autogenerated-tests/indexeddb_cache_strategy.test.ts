import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { IndexedDbCacheStrategy } from '../packages/core-web/src/cache/IndexedDbCacheStrategy';
import {
  ContentCacheRegistry,
  streamToUint8Array,
  uint8ArrayToStream,
} from '@acc/core-isomorphic';

describe('IndexedDbCacheStrategy (Standalone Capacity Pattern)', () => {
  beforeEach(() => {
    ContentCacheRegistry.reset();
  });

  describe('When indexedDB is absent (SSR / Node / Bun without indexedDB)', () => {
    it('initializes with correct ID and name', () => {
      const strategy = new IndexedDbCacheStrategy();
      expect(strategy.id).toBe('indexeddb');
      expect(strategy.name).toBe('Browser IndexedDB Content Cache');
    });

    it('operates on its own capacity with zero in-memory fallback retention', async () => {
      const strategy = new IndexedDbCacheStrategy();
      const payload = new Uint8Array([1, 2, 3, 4, 5]);

      expect(await strategy.has('blob/item-1')).toBe(false);
      expect(await strategy.get('blob/item-1')).toBeNull();
      expect(await strategy.getBlob('blob/item-1')).toBeNull();
      expect(await strategy.getStream('blob/item-1')).toBeNull();
      expect(await strategy.getMetadata('blob/item-1')).toBeNull();

      // Setting without indexedDB should be a safe no-op and never allocate an in-memory Map
      await strategy.set('blob/item-1', payload);
      expect(await strategy.has('blob/item-1')).toBe(false);
      expect(await strategy.get('blob/item-1')).toBeNull();

      const blob = new Blob(['test-blob']);
      await strategy.setBlob('blob-2', blob);
      expect(await strategy.has('blob-2')).toBe(false);
      expect(await strategy.getBlob('blob-2')).toBeNull();

      expect(await strategy.getKeys()).toEqual([]);
      expect(await strategy.delete('blob/item-1')).toBe(false);
      await strategy.clear();
    });
  });

  describe('When indexedDB is available (Browser or simulated IDB)', () => {
    let storeMap: Map<string, any>;
    let originalIDB: typeof globalThis.indexedDB;

    const createReq = (result?: any) => {
      const req: any = { result };
      let cb: any = null;
      Object.defineProperty(req, 'onsuccess', {
        set(fn) {
          cb = fn;
          setTimeout(() => cb && cb({ target: req }), 0);
        },
        get() {
          return cb;
        },
      });
      return req;
    };

    beforeEach(() => {
      storeMap = new Map();
      const mockDb = {
        transaction: () => ({
          objectStore: () => ({
            count: (k: string) => createReq(storeMap.has(k) ? 1 : 0),
            get: (k: string) => createReq(storeMap.get(k)),
            put: (rec: any) => {
              storeMap.set(rec.key, rec);
              return createReq();
            },
            delete: (k: string) => {
              storeMap.delete(k);
              return createReq();
            },
            getAllKeys: () => createReq(Array.from(storeMap.keys())),
            clear: () => {
              storeMap.clear();
              return createReq();
            },
          }),
        }),
      };

      originalIDB = (globalThis as any).indexedDB;
      (globalThis as any).indexedDB = {
        open: () => createReq(mockDb),
      };
    });

    afterEach(() => {
      if (originalIDB !== undefined) {
        (globalThis as any).indexedDB = originalIDB;
      } else {
        delete (globalThis as any).indexedDB;
      }
    });

    it('performs CRUD operations directly against IndexedDB store', async () => {
      const strategy = new IndexedDbCacheStrategy();
      const data = new Uint8Array([10, 20, 30, 40]);

      expect(await strategy.has('asset-1')).toBe(false);
      await strategy.set('asset-1', data, { mimeType: 'image/png' });

      expect(await strategy.has('asset-1')).toBe(true);
      expect(await strategy.has('asset-nonexistent')).toBe(false);

      const retrieved = await strategy.get('asset-1');
      expect(retrieved).toEqual(data);

      const keys = await strategy.getKeys();
      expect(keys).toContain('asset-1');

      const meta = await strategy.getMetadata('asset-1');
      expect(meta).not.toBeNull();
      expect(meta?.mimeType).toBe('image/png');

      await strategy.delete('asset-1');
      expect(await strategy.has('asset-1')).toBe(false);
      expect(await strategy.get('asset-1')).toBeNull();
    });

    it('supports Blob and ReadableStream operations natively in IndexedDB', async () => {
      const strategy = new IndexedDbCacheStrategy();
      const blob = new Blob(['idb-stream-test'], { type: 'text/plain' });

      await strategy.setBlob('idb-blob', blob, {
        mimeType: 'text/plain',
        metadata: { tag: 'idb-unit' },
      });

      expect(await strategy.has('idb-blob')).toBe(true);

      const retrievedBlob = await strategy.getBlob('idb-blob');
      expect(retrievedBlob).not.toBeNull();
      expect(await retrievedBlob!.text()).toBe('idb-stream-test');

      // Stream retrieval
      const stream = await strategy.getStream('idb-blob');
      expect(stream).not.toBeNull();
      const bytes = await streamToUint8Array(stream!);
      expect(new TextDecoder().decode(bytes)).toBe('idb-stream-test');

      // Stream set
      const writeStream = uint8ArrayToStream(new TextEncoder().encode('streaming-idb-data'));
      await strategy.setStream('stream-key', writeStream, { mimeType: 'text/plain' });
      const streamRes = await strategy.getStream('stream-key');
      expect(streamRes).not.toBeNull();
      const readBackBytes = await streamToUint8Array(streamRes!);
      expect(new TextDecoder().decode(readBackBytes)).toBe('streaming-idb-data');
    });

    it('clears all entries in IndexedDB', async () => {
      const strategy = new IndexedDbCacheStrategy();
      await strategy.set('k1', new Uint8Array([1]));
      await strategy.set('k2', new Uint8Array([2]));
      expect((await strategy.getKeys()).length).toBe(2);

      await strategy.clear();
      expect((await strategy.getKeys()).length).toBe(0);
      expect(await strategy.has('k1')).toBe(false);
    });
  });
});
