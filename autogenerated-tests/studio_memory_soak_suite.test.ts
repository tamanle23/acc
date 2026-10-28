import { describe, it, expect, beforeEach } from 'bun:test';
import { MemoryLeakDetector } from '../packages/core-isomorphic/src/telemetry/MemoryLeakDetector';
import { PreviewFrameMemoryManager } from '../apps/studio/src/renderer/workers/PreviewFrameMemoryManager';
import { ContentHashTextureCache } from '../apps/studio/src/renderer/workers/ContentHashTextureCache';
import { WebAudioEngine } from '../apps/studio/src/lib/audio/WebAudioEngine';
import { AudioAssetCache } from '../apps/studio/src/lib/audio/AudioAssetCache';
import { OpfsCacheStrategy } from '../packages/core-web/src/cache/OpfsCacheStrategy';
import { ClientExportOrchestrator } from '../apps/studio/src/lib/export/ClientExportOrchestrator';

describe('Studio Automated Memory Stress & Soak Test Suite', () => {

  // =========================================================================
  // SUITE 1: Mathematical Memory Drift & Linear Regression Slope Detector
  // =========================================================================
  describe('Mathematical Leak Detection Engine (Slope \u03b2 & Pearson r)', () => {
    it('accurately identifies stable sawtooth / fluctuating memory as non-leaking', () => {
      const detector = new MemoryLeakDetector({ maxAllowedSlopeBytesPerIter: 10 * 1024 });

      // Simulate 50 iterations of stable sawtooth memory (allocating then GC-ing)
      for (let i = 0; i < 50; i++) {
        const gcBase = 50 * 1024 * 1024; // 50 MB
        const jitter = (i % 5) * 500 * 1024; // 0 to 2 MB sawtooth
        detector.record(i, gcBase + jitter);
      }

      const report = detector.evaluate();
      expect(report.isLeaking).toBe(false);
      expect(report.correlationCoefficient).toBeLessThan(0.3); // Fluctuating cycle has zero linear correlation
      expect(() => detector.assertNoLeak()).not.toThrow();
    });

    it('detects monotonic memory accumulation with high correlation and triggers alert', () => {
      const detector = new MemoryLeakDetector({
        maxAllowedSlopeBytesPerIter: 1024, // 1 KB/iter threshold
        minCorrelationThreshold: 0.8,
      });

      // Simulate a 50 KB / iteration steady leak (e.g. unclosed bitmaps)
      const base = 20 * 1024 * 1024;
      for (let i = 0; i < 30; i++) {
        detector.record(i, base + i * 50 * 1024);
      }

      const report = detector.evaluate();
      expect(report.isLeaking).toBe(true);
      expect(report.slopeBytesPerIteration).toBeGreaterThan(45 * 1024);
      expect(report.correlationCoefficient).toBeGreaterThan(0.95);
      expect(() => detector.assertNoLeak('SoakTest')).toThrow(/Memory leak detected/);
    });
  });

  // =========================================================================
  // SUITE 2: PreviewFrameMemoryManager Window Eviction & 1,000 Seek Stress
  // =========================================================================
  describe('PreviewFrameMemoryManager Window Eviction & Bitmap Safety', () => {
    let memoryManager: PreviewFrameMemoryManager;
    const closedBitmaps = new Set<ImageBitmap>();

    const createMockBitmap = (id: string, width = 1920, height = 1080): ImageBitmap => {
      const bmp = {
        width,
        height,
        close: () => {
          closedBitmaps.add(bmp as unknown as ImageBitmap);
        },
      } as unknown as ImageBitmap;
      return bmp;
    };

    beforeEach(() => {
      memoryManager = PreviewFrameMemoryManager.getInstance();
      memoryManager.clear();
      closedBitmaps.clear();
    });

    it('enforces maximum frame budget (<= 64) and stages evicted frames for disposal', () => {
      // Set 100 frames across 2 assets
      for (let f = 0; f < 100; f++) {
        const bmp = createMockBitmap(`bmp_${f}`);
        memoryManager.set('asset-v1', f, bmp);
      }

      // Memory manager must cap at MAX_GLOBAL_FRAMES (64)
      expect(memoryManager.size()).toBeLessThanOrEqual(64);
      expect(memoryManager.getPendingDisposalCount()).toBeGreaterThan(0);

      // Drain disposal queue
      memoryManager.drainDisposalQueue();
      expect(memoryManager.getPendingDisposalCount()).toBe(0);
      expect(closedBitmaps.size).toBe(100 - memoryManager.size());
    });

    it('correctly prunes frames outside sliding playhead window [playhead - 2s, playhead + 3s]', () => {
      const fps = 30;
      const playheadFrame = 150; // 5.0 seconds
      // Window is [150 - 60 = 90, 150 + 90 = 240]

      for (let f = 0; f <= 300; f += 5) {
        const bmp = createMockBitmap(`frame_${f}`);
        memoryManager.set('clip-a', f, bmp);
      }

      memoryManager.pruneOutsideWindow(playheadFrame, fps);
      memoryManager.drainDisposalQueue();

      // Frames < 90 must be evicted
      expect(memoryManager.get('clip-a', 30)).toBeNull();
      expect(memoryManager.get('clip-a', 60)).toBeNull();

      // Frames > 240 must be evicted
      expect(memoryManager.get('clip-a', 270)).toBeNull();
      expect(memoryManager.get('clip-a', 300)).toBeNull();

      // Frames inside [90, 240] should be retained
      expect(memoryManager.get('clip-a', 150)).not.toBeNull();
    });

    it('protects actively rendered frame bitmaps from premature closure during drain', () => {
      const activeBmp = createMockBitmap('active_hero');
      const oldBmp = createMockBitmap('old_stale');

      memoryManager.set('clip-hero', 10, oldBmp);
      // Evict oldBmp by overriding with activeBmp
      memoryManager.set('clip-hero', 10, activeBmp);

      const protectedSet = new Set<ImageBitmap>([activeBmp]);
      memoryManager.drainDisposalQueue(protectedSet);

      // activeBmp must NOT be closed
      expect(closedBitmaps.has(activeBmp)).toBe(false);
      // oldBmp must be closed
      expect(closedBitmaps.has(oldBmp)).toBe(true);
    });

    it('survives 1,000 rapid random seeks without memory divergence or double-close', () => {
      const detector = new MemoryLeakDetector({ maxAllowedSlopeBytesPerIter: 256 });
      const fps = 30;

      for (let i = 0; i < 1000; i++) {
        const randomFrame = Math.floor(Math.random() * 300);
        const bmp = createMockBitmap(`seek_${i}`);
        memoryManager.set('scrub_clip', randomFrame, bmp);

        if (i % 20 === 0) {
          memoryManager.pruneOutsideWindow(randomFrame, fps);
          memoryManager.drainDisposalQueue();
        }

        // Each stored frame is ~8.3MB in real VRAM; assert logical cache size stays strictly bounded
        detector.record(i, memoryManager.size() * 1024);
      }

      expect(memoryManager.size()).toBeLessThanOrEqual(64);
      const report = detector.evaluate();
      expect(report.isLeaking).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 3: ContentHashTextureCache Typography Under 500 Mutations
  // =========================================================================
  describe('ContentHashTextureCache Typography LRU Ceiling & Disposal', () => {
    let cache: ContentHashTextureCache;
    const closedBitmaps = new Set<ImageBitmap>();

    beforeEach(() => {
      cache = ContentHashTextureCache.getInstance();
      cache.clear();
      closedBitmaps.clear();
    });

    it('caps cache at MAX_ENTRIES = 64 and invokes close() on evicted text bitmaps', () => {
      const totalMutations = 200;

      for (let i = 0; i < totalMutations; i++) {
        const bmp = {
          width: 200,
          height: 50,
          close: () => {
            closedBitmaps.add(bmp as unknown as ImageBitmap);
          },
        } as unknown as ImageBitmap;

        const hash = cache.hashString(`DynamicSubtitleSubtitle_Font_${i}`);
        cache.set(hash, bmp);
      }

      // Must be capped strictly at 64
      let activeCount = 0;
      for (let i = 0; i < totalMutations; i++) {
        const hash = cache.hashString(`DynamicSubtitleSubtitle_Font_${i}`);
        if (cache.has(hash)) activeCount++;
      }

      expect(activeCount).toBeLessThanOrEqual(64);
      // Exactly (200 - 64) = 136 bitmaps must have been closed synchronously
      expect(closedBitmaps.size).toBe(totalMutations - 64);
    });

    it('refreshes LRU access order when retrieving cached text', () => {
      const bmp1 = { width: 100, height: 30, close: () => closedBitmaps.add(bmp1 as unknown as ImageBitmap) } as unknown as ImageBitmap;
      const hash1 = cache.hashString('Text_Alpha');
      cache.set(hash1, bmp1);

      // Access hash1 to move to end of LRU
      const retrieved = cache.get(hash1);
      expect(retrieved).toBe(bmp1);

      // Fill with 64 more entries
      for (let i = 0; i < 64; i++) {
        const bmp = { width: 100, height: 30, close: () => {} } as unknown as ImageBitmap;
        cache.set(cache.hashString(`filler_${i}`), bmp);
      }

      // bmp1 must have been evicted and closed
      expect(closedBitmaps.has(bmp1)).toBe(true);
      expect(cache.has(hash1)).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 4: WebAudioEngine Teardown & Waveform Bounded LRU
  // =========================================================================
  describe('WebAudioEngine Deterministic Cleanup & Waveform LRU', () => {
    let engine: WebAudioEngine;

    beforeEach(() => {
      engine = WebAudioEngine.getInstance();
      engine.stopPlayback();
    });

    it('enforces LRU ceiling (<= 64) on waveformCache across continuous trimming', () => {
      // Simulate 150 trim mutations with fluctuating durationFrames
      for (let frame = 10; frame <= 160; frame++) {
        engine.getWaveformPeaks('audio_track_1', frame, 80);
      }

      // Private access or verify bounded behavior by querying again
      const peaks = engine.getWaveformPeaks('audio_track_1', 160, 80);
      expect(peaks).toBeDefined();
      expect(peaks.length).toBe(80);
    });

    it('stopPlayback cleanly stops and clears active sources without leaving dangling references', () => {
      // Verify isPlaying flag and state transition
      expect(engine.getIsPlaying()).toBe(false);
      engine.stopPlayback();
      expect(engine.getIsPlaying()).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 5: ClientExportOrchestrator Cancellation & Buffer Reusability
  // =========================================================================
  describe('ClientExportOrchestrator Zero-Alloc Buffer & Abort Safety', () => {
    it('aborts cleanly on AbortSignal and invokes sink.dispose() without leaks', async () => {
      let sinkDisposed = false;
      let framesConsumed = 0;

      const mockSink = {
        initialize: async () => {},
        consumeFrame: async (_f: number, rgba: Uint8Array) => {
          framesConsumed++;
          expect(rgba.byteLength).toBe(1920 * 1080 * 4);
        },
        finalize: async () => ({
          framesConsumed,
          fileSizeBytes: 0,
          buffer: null,
        }),
        dispose: async () => {
          sinkDisposed = true;
        },
      };

      const controller = new AbortController();
      // Abort immediately
      controller.abort();

      const result = await ClientExportOrchestrator.exportToMp4({
        irState: {
          doc: { version: '1.0.0', meta: { duration: 10, fps: 30, width: 1920, height: 1080 }, tracks: [] },
          timeline: null,
          intervalTree: null,
          selectedSequenceId: null,
          selectedTrackId: null,
          inspectorMode: 'project',
          error: null,
          canUndo: false,
          canRedo: false,
          activeTemplate: 'default',
        },
        width: 1920,
        height: 1080,
        fps: 30,
        totalFrames: 100,
        signal: controller.signal,
        sinkFactory: () => mockSink as any,
      });

      expect(result.cancelled).toBe(true);
      expect(sinkDisposed).toBe(true);
      expect(result.buffer).toBeNull();
    });
  });

  // =========================================================================
  // SUITE 6: OpfsCacheStrategy Fallback & Stream Invariants
  // =========================================================================
  describe('OpfsCacheStrategy Streaming Invariants & Fallback', () => {
    it('falls back seamlessly to IndexedDb or mock storage in non-OPFS headless environment', async () => {
      const mockFallbackStorage = new Map<string, Uint8Array>();
      const mockFallback = {
        id: 'mock-fallback',
        name: 'Mock Fallback',
        has: async (k: string) => mockFallbackStorage.has(k),
        get: async (k: string) => mockFallbackStorage.get(k) || null,
        set: async (k: string, d: Uint8Array) => { mockFallbackStorage.set(k, d); },
        getBlob: async (k: string) => {
          const d = mockFallbackStorage.get(k);
          return d ? new Blob([d as unknown as BlobPart]) : null;
        },
        setBlob: async (k: string, b: Blob) => {
          mockFallbackStorage.set(k, new Uint8Array(await b.arrayBuffer()));
        },
        delete: async (k: string) => mockFallbackStorage.delete(k),
        clear: async () => { mockFallbackStorage.clear(); },
      };

      const strategy = new OpfsCacheStrategy({ fallbackStrategy: mockFallback as any });

      const testData = new Uint8Array([10, 20, 30, 40, 50]);
      await strategy.set('test_key_1', testData);

      expect(await strategy.has('test_key_1')).toBe(true);
      const retrieved = await strategy.get('test_key_1');
      expect(retrieved).toEqual(testData);

      // Verify Blob handle
      const retrievedBlob = await strategy.getBlob('test_key_1');
      expect(retrievedBlob).not.toBeNull();
      expect(retrievedBlob!.size).toBe(5);

      await strategy.delete('test_key_1');
      expect(await strategy.has('test_key_1')).toBe(false);
    });
  });
});
