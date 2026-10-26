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
      expect(VisionEngineRegistry.getDefaultDepthStrategyId()).toBe(DepthStrategyId.Heuristic);
      expect(VisionEngineRegistry.getDefaultSegmentationStrategyId()).toBe(SegmentationStrategyId.GrabCutFallback);
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

  describe('IndexedDbCacheStrategy (in-memory fallback mode)', () => {
    it('stores, retrieves, checks, and deletes items', async () => {
      const cache = new IndexedDbCacheStrategy();
      expect(cache.id).toBe('indexeddb');

      const data = new Uint8Array([10, 20, 30, 40]);
      await cache.set('asset-1', data, { mimeType: 'image/png' });

      expect(await cache.has('asset-1')).toBe(true);
      expect(await cache.has('asset-nonexistent')).toBe(false);

      const retrieved = await cache.get('asset-1');
      expect(retrieved).toEqual(data);

      await cache.delete('asset-1');
      expect(await cache.has('asset-1')).toBe(false);
      expect(await cache.get('asset-1')).toBeNull();
    });
  });
});
