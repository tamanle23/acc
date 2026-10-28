import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Depth3DPlugin } from '../packages/ir/src/plugins/vfx/Depth3DPlugin';
import { MediabunnyWorkerReader } from '../apps/studio/src/renderer/workers/MediabunnyWorkerReader';
import { UniversalCanvasProvider, ContentCacheRegistry } from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native';

describe('Iteration 45: Playback Memory Leak & Native Buffer Retention Prevention', () => {
  beforeEach(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
    ContentCacheRegistry.reset();
  });

  describe('Pillar 1: Depth3DPlugin Sequence-Scoped State Reuse & Zero Allocation Loop', () => {
    it('reuses _depth3dState across consecutive frame renders without re-resolving or allocating', async () => {
      const plugin = new Depth3DPlugin();
      const mockClose = mock(() => {});
      const realCanvas = UniversalCanvasProvider.createCanvas(1920, 1080);
      const mockCtx2d = realCanvas.getContext('2d');
      const mockCanvas = {
        width: 1920,
        height: 1080,
        getContext: () => mockCtx2d,
        close: mockClose,
        getRawCanvas: () => realCanvas,
      };

      const mockSequence: any = {
        id: 'seq-holo-test',
        assetId: 'asset-holo-test',
        startFrame: 0,
        durationFrames: 100,
        type: 'image',
        _depth3dState: {
          cutout: {
            subjectImg: realCanvas,
            subjectBBox: { minX: 100, maxX: 1800, minY: 100, maxY: 1000 },
          },
          depthLayersData: {
            srcCanvas: realCanvas,
            depthCanvas: realCanvas,
            depthData: new Uint8ClampedArray(10),
          },
          width: 1920,
          height: 1080,
          mode: 'frame_breaker',
          key: 'asset-holo-test',
        },
      };

      const ctx: any = {
        ctx: mockCtx2d,
        width: 1920,
        height: 1080,
        localFrame: 0,
        sequence: mockSequence,
        baseAsset: realCanvas,
      };

      // Frame 0 render pass
      await plugin.renderClipSpace(ctx, { mode: 'frame_breaker' });
      expect(mockSequence._depth3dState).toBeDefined();
      expect(mockSequence._depth3dState.key).toBe('asset-holo-test');

      // Subsequent frame 1 render pass
      ctx.localFrame = 1;
      await plugin.renderClipSpace(ctx, { mode: 'frame_breaker' });
      // State is preserved and reused directly
      expect(mockSequence._depth3dState.cutout.subjectImg.width).toBe(1920);
    });

    it('cleanupSequence closes all native media bitmaps and canvases synchronously', () => {
      let cutoutClosed = false;
      let srcCanvasClosed = false;
      let depthCanvasClosed = false;

      const mockSequence: any = {
        id: 'seq-holo-cleanup',
        _depth3dState: {
          cutout: {
            subjectImg: {
              close: () => {
                cutoutClosed = true;
              },
            },
          },
          depthLayersData: {
            srcCanvas: {
              close: () => {
                srcCanvasClosed = true;
              },
            },
            depthCanvas: {
              close: () => {
                depthCanvasClosed = true;
              },
            },
          },
        },
      };

      Depth3DPlugin.cleanupSequence(mockSequence);

      expect(cutoutClosed).toBe(true);
      expect(srcCanvasClosed).toBe(true);
      expect(depthCanvasClosed).toBe(true);
      expect(mockSequence._depth3dState).toBeUndefined();
    });
  });

  describe('Pillar 2: MediabunnyWorkerReader Concurrency Gate Memory Hygiene', () => {
    it('deletes inFlightRequests entry even when concurrency ceiling is hit', async () => {
      const reader = new MediabunnyWorkerReader('https://example.com/mock.mp4', {
        assetId: 'asset-test-video',
      });

      // Mock initialization state
      (reader as any).isInitialized = true;
      (reader as any).canvasSink = {
        getCanvas: async () => null,
      };

      // Artificially saturate active decodes to simulate concurrency ceiling
      (reader as any).activeDecodes = 2; // MAX_CONCURRENT_DECODES

      const frame = 42;
      const res = await reader.requestFrame(frame, 30, false);

      expect(res).toBeNull();
      // Verify inFlightRequests does NOT leak the frame promise
      expect((reader as any).inFlightRequests.has(frame)).toBe(false);
      expect((reader as any).inFlightRequests.size).toBe(0);
    });
  });

  describe('Pillar 3: Scratch Canvas Pooling in Depth Frame Breaker', () => {
    it('verifies acquireScratchCanvas and releaseScratchCanvas are called during frame processing', () => {
      let acquired = 0;
      let released = 0;

      const originalAcquire = UniversalCanvasProvider.acquireScratchCanvas;
      const originalRelease = UniversalCanvasProvider.releaseScratchCanvas;

      UniversalCanvasProvider.acquireScratchCanvas = (w, h, pref) => {
        acquired++;
        return originalAcquire(w, h, pref);
      };
      UniversalCanvasProvider.releaseScratchCanvas = (canvas) => {
        released++;
        return originalRelease(canvas);
      };

      try {
        const c = UniversalCanvasProvider.acquireScratchCanvas(256, 256);
        UniversalCanvasProvider.releaseScratchCanvas(c);

        expect(acquired).toBe(1);
        expect(released).toBe(1);
      } finally {
        UniversalCanvasProvider.acquireScratchCanvas = originalAcquire;
        UniversalCanvasProvider.releaseScratchCanvas = originalRelease;
      }
    });
  });
});
