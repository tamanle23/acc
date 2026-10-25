import { describe, it, expect } from 'bun:test';
import { WaveformLODPyramid } from '../apps/studio/src/lib/timeline/WaveformLODPyramid';
import { ThumbnailLRUCache } from '../apps/studio/src/lib/timeline/ThumbnailLRUCache';
import type { ClipLayoutEntry } from '../apps/studio/src/workers/timelineTypes';

describe('Timeline Virtualization & Memory Hygiene Suite', () => {
  describe('WaveformLODPyramid (Multi-Resolution Peak Decimation)', () => {
    it('constructs a 4-level decimation pyramid from raw peak samples', () => {
      const rawSamples = new Float32Array(1024);
      for (let i = 0; i < rawSamples.length; i++) {
        rawSamples[i] = Math.sin(i / 10);
      }

      const pyramid = new WaveformLODPyramid(rawSamples);
      expect(pyramid.getLevelsCount()).toBe(4);

      // Check downsampling scale factors: 1024 -> 256 -> 64 -> 16
      expect(pyramid.getPeaksAtLevel(0).length).toBe(1024);
      expect(pyramid.getPeaksAtLevel(1).length).toBe(256);
      expect(pyramid.getPeaksAtLevel(2).length).toBe(64);
      expect(pyramid.getPeaksAtLevel(3).length).toBe(16);
    });

    it('dynamically selects the appropriate LOD level based on zoom scale (px/frame)', () => {
      const rawSamples = new Float32Array(512);
      const pyramid = new WaveformLODPyramid(rawSamples);

      // Deep zoom in (>= 4px/frame) -> Level 0
      const lodHigh = pyramid.selectLOD(5.0);
      expect(lodHigh.levelIndex).toBe(0);

      // Normal zoom (1.0 to 4.0 px/frame) -> Level 1
      const lodNorm = pyramid.selectLOD(2.0);
      expect(lodNorm.levelIndex).toBe(1);

      // Zoomed out (0.25 to 1.0 px/frame) -> Level 2
      const lodOut = pyramid.selectLOD(0.5);
      expect(lodOut.levelIndex).toBe(2);

      // Wide overview (< 0.25 px/frame) -> Level 3
      const lodOverview = pyramid.selectLOD(0.1);
      expect(lodOverview.levelIndex).toBe(3);
    });
  });

  describe('ThumbnailLRUCache (Explicit Bitmap Disposal)', () => {
    it('evicts oldest items and calls close() explicitly to prevent GPU memory leaks', () => {
      const cache = new ThumbnailLRUCache(3);
      let closeCount = 0;

      const mockBitmap = (id: string) => ({
        width: 100,
        height: 60,
        close: () => {
          closeCount++;
        },
      });

      cache.set('t1', mockBitmap('t1'));
      cache.set('t2', mockBitmap('t2'));
      cache.set('t3', mockBitmap('t3'));

      expect(cache.size()).toBe(3);
      expect(closeCount).toBe(0);

      // Access t1 to mark it recently used (order becomes: t2, t3, t1)
      cache.get('t1');

      // Adding t4 should evict t2 (the least recently used)
      cache.set('t4', mockBitmap('t4'));
      expect(cache.size()).toBe(3);
      expect(cache.has('t2')).toBe(false);
      expect(cache.has('t1')).toBe(true);
      expect(cache.has('t4')).toBe(true);
      expect(closeCount).toBe(1); // t2 was explicitly closed!
    });

    it('calls close() on clear()', () => {
      const cache = new ThumbnailLRUCache(5);
      let closeCount = 0;
      const mock = () => ({ width: 10, height: 10, close: () => closeCount++ });

      cache.set('a', mock());
      cache.set('b', mock());
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
      expect(closeCount).toBe(2);
    });
  });

  describe('TimelineWorkerBridge (OffscreenCanvas Lifecycle Guard)', () => {
    it('prevents multiple transferControlToOffscreen calls on already transferred canvas DOM nodes', async () => {
      // Mock browser environment in Bun test runner
      (globalThis as any).window = globalThis;
      (globalThis as any).HTMLCanvasElement = class HTMLCanvasElement {
        transferControlToOffscreen() {}
      };
      (globalThis as any).Worker = class MockWorker {
        postMessage() {}
        terminate() {}
      };

      const { TimelineWorkerBridge } = await import('../apps/studio/src/lib/timeline/TimelineWorkerBridge');
      const bridge = new TimelineWorkerBridge();

      let transferCount = 0;
      const mockCanvas: any = {
        transferControlToOffscreen: () => {
          transferCount++;
          return {} as any;
        },
      };

      const dummyModel: any = { tracks: [], clips: [], totalFrames: 100, fps: 30 };
      const dummyViewport: any = { scrollLeft: 0, scrollTop: 0, viewportWidth: 1000, viewportHeight: 300, pixelsPerFrame: 4, dpr: 1 };

      const ok1 = bridge.init(mockCanvas, dummyModel, dummyViewport);
      expect(ok1).toBe(true);
      expect(transferCount).toBe(1);
      expect(mockCanvas.__transferred).toBe(true);

      // Now simulate a remount where the bridge was disposed and a new bridge attempts to init with the same canvas
      bridge.dispose();

      const newBridge = new TimelineWorkerBridge();
      // Should reject without calling transferControlToOffscreen or throwing InvalidStateError
      const ok2 = newBridge.init(mockCanvas, dummyModel, dummyViewport);
      expect(ok2).toBe(false);
      expect(transferCount).toBe(1); // not called again
      newBridge.dispose();
    });
  });
});

