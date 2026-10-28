import { describe, it, expect, beforeEach } from 'bun:test';
import {
  WebCanvasAdapter,
  MediabunnyClientSink,
  MediabunnyClientStrategy,
  IndexedDbCacheStrategy,
  bootstrapClient,
} from '../packages/core-web/src';
import {
  UniversalCanvasProvider,
  MediaEngineRegistry,
  ContentCacheRegistry,
  VisionEngineRegistry,
  DepthStrategyId,
  SegmentationStrategyId,
} from '@acc/core-isomorphic';

describe('Phase 2: Core Web Services Suite (@acc/core-web)', () => {
  beforeEach(() => {
    MediaEngineRegistry.reset();
    ContentCacheRegistry.reset();
    VisionEngineRegistry.reset();
  });

  describe('bootstrapClient()', () => {
    it('registers WebCanvasAdapter, MediabunnyClientStrategy, and IndexedDbCacheStrategy', () => {
      bootstrapClient();

      expect(MediaEngineRegistry.has('mediabunny-client')).toBe(true);
      expect(ContentCacheRegistry.has('indexeddb')).toBe(true);
      expect(ContentCacheRegistry.get().id).toBe('indexeddb');
      expect(VisionEngineRegistry.hasDepthStrategy(DepthStrategyId.Heuristic)).toBe(true);
      expect(VisionEngineRegistry.hasSegmentationStrategy(SegmentationStrategyId.GrabCutFallback)).toBe(true);
      expect(VisionEngineRegistry.getDefaultDepthStrategyId()).toBe(DepthStrategyId.DepthAnythingV2Small);
      expect(VisionEngineRegistry.getDefaultSegmentationStrategyId()).toBe(SegmentationStrategyId.Rmbg);
    });
  });

  describe('MediabunnyClientSink & MediabunnyClientStrategy', () => {
    it('creates MediabunnyClientSink instance via strategy', () => {
      const strategy = new MediabunnyClientStrategy();
      expect(strategy.id).toBe('mediabunny-client');
      expect(strategy.capabilities.supportsBrowserRuntime).toBe(true);

      const sink = strategy.createVideoSink({
        width: 640,
        height: 360,
        fps: 30,
        totalFrames: 10,
        durationSeconds: 0.333,
      });

      expect(sink).toBeInstanceOf(MediabunnyClientSink);
      expect(sink.id).toBe('mediabunny-client-sink');
    });

    it('initializes MediabunnyClientSink with expected contract methods', async () => {
      const sink = new MediabunnyClientSink();
      expect(typeof sink.initialize).toBe('function');
      expect(typeof sink.consumeFrame).toBe('function');
      expect(typeof sink.finalize).toBe('function');
      expect(typeof sink.getBuffer).toBe('function');
    });
  });

  describe('IndexedDbCacheStrategy (standalone capacity)', () => {
    it('operates on its own capacity with zero in-memory fallback retention when indexedDB is absent', async () => {
      const cache = new IndexedDbCacheStrategy();
      expect(cache.id).toBe('indexeddb');

      const data = new Uint8Array([10, 20, 30, 40]);
      await cache.set('asset-1', data, { mimeType: 'image/png' });

      expect(await cache.has('asset-1')).toBe(false);
      expect(await cache.get('asset-1')).toBeNull();
      expect(await cache.getBlob('asset-1')).toBeNull();
      expect(await cache.getStream('asset-1')).toBeNull();
      expect(await cache.getKeys()).toEqual([]);
      expect(await cache.delete('asset-1')).toBe(false);
    });

    it('performs CRUD directly against IndexedDB store when indexedDB is available', async () => {
      const storeMap = new Map<string, any>();
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

      const originalIDB = (globalThis as any).indexedDB;
      (globalThis as any).indexedDB = {
        open: () => createReq(mockDb),
      };

      try {
        const cache = new IndexedDbCacheStrategy();
        const data = new Uint8Array([1, 2, 3]);
        await cache.set('item-1', data);

        expect(await cache.has('item-1')).toBe(true);
        expect(await cache.get('item-1')).toEqual(data);
        expect((await cache.getKeys()).length).toBe(1);

        await cache.delete('item-1');
        expect(await cache.has('item-1')).toBe(false);
      } finally {
        if (originalIDB !== undefined) {
          (globalThis as any).indexedDB = originalIDB;
        } else {
          delete (globalThis as any).indexedDB;
        }
      }
    });
  });
});
