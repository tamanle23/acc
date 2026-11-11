import { describe, it, expect, beforeAll } from 'bun:test';
import { UniversalCanvasProvider, ContentCacheRegistry } from '@acc/core-isomorphic';
import { bootstrapNode } from '../packages/core/src/bootstrap';
import { BoundedDecoderPool } from '../packages/ir/src/renderer/BoundedDecoderPool';
import {
  IRMasterRenderer,
  type ResolvedTimeline,
  type ResolvedTrack,
  type ResolvedSequence,
  type IIRFrameSink,
  type SinkFinalizeResult,
} from '../packages/ir/src';
import type { IMediaEngineStrategy, IVideoDecoder, IContentCacheStrategy } from '@acc/core-isomorphic';

function createMemoryCache(): IContentCacheStrategy {
  const store = new Map<string, Blob>();
  return {
    id: 'memory-test',
    name: 'Memory Test Cache',
    has: async (k: string) => store.has(k),
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, d: unknown) => {
      store.set(k, d as Blob);
    },
  } as unknown as IContentCacheStrategy;
}

describe('Phase 3: Multi-Track Playback & Bounded JIT Video Decoder Stress Testing', () => {
  beforeAll(async () => {
    await bootstrapNode();
    ContentCacheRegistry.register(createMemoryCache(), true);
  });

  it('BoundedDecoderPool: caps concurrent active decoders strictly to quota under high demand', async () => {
    const pool = new BoundedDecoderPool(4);
    expect(pool.getMaxConcurrent()).toBe(4);

    let activeInstances = 0;
    const mockStrategy: IMediaEngineStrategy = {
      createVideoDecoder: (path: string, w: number, h: number): IVideoDecoder => {
        return {
          open: async () => {
            activeInstances++;
            return true;
          },
          close: () => {
            activeInstances--;
          },
          readNextFrame: async () => ({ width: w, height: h }),
        };
      },
    } as any;

    // Acquire 6 different assets sequentially with increasing priorities
    for (let i = 1; i <= 6; i++) {
      const dec = await pool.acquire(
        `asset-${i}`,
        `/path/to/asset-${i}.mp4`,
        320,
        240,
        mockStrategy,
        i * 10
      );
      expect(dec).toBeDefined();
      expect(pool.getActiveCount()).toBeLessThanOrEqual(4);
      expect(activeInstances).toBeLessThanOrEqual(4);
    }

    // Lowest priority items (asset-1 and asset-2) must have been evicted
    expect(pool.has('asset-1')).toBe(false);
    expect(pool.has('asset-2')).toBe(false);
    expect(pool.has('asset-5')).toBe(true);
    expect(pool.has('asset-6')).toBe(true);

    pool.closeAll();
    expect(pool.getActiveCount()).toBe(0);
    expect(activeInstances).toBe(0);
  });

  it('IRMasterRenderer: exports 6-track overlapping timeline without exceeding hardware decoder quota', async () => {
    let currentHardwareDecoders = 0;
    let maxObservedDecoders = 0;

    // Mock strategy that simulates hardware QuotaExceededError if > 4 decoders are open simultaneously
    const strictHardwareStrategy: IMediaEngineStrategy = {
      createVideoDecoder: (path: string, w: number, h: number): IVideoDecoder => {
        let isOpen = false;
        return {
          open: async () => {
            if (currentHardwareDecoders >= 4) {
              throw new Error('QuotaExceededError: Browser hardware video decoder quota exceeded (max 4)');
            }
            isOpen = true;
            currentHardwareDecoders++;
            if (currentHardwareDecoders > maxObservedDecoders) {
              maxObservedDecoders = currentHardwareDecoders;
            }
            return true;
          },
          close: () => {
            if (isOpen) {
              isOpen = false;
              currentHardwareDecoders--;
            }
          },
          readNextFrame: async () => null,
          seekTimestamp: async () => null,
        };
      },
    } as any;

    // Construct a multi-track timeline with 6 simultaneous video tracks (0 to 10 frames)
    const tracks = new Map<string, ResolvedTrack>();
    const assets: Record<string, any> = {};

    for (let t = 1; t <= 6; t++) {
      const assetId = `video-track-asset-${t}`;
      assets[assetId] = {
        id: assetId,
        type: 'video',
        src: `/mock/path/${assetId}.mp4`,
      };

      const seq: ResolvedSequence = {
        id: `seq-${t}`,
        trackId: `track-${t}`,
        type: 'video',
        assetId,
        startFrame: 0,
        endFrame: 10,
        durationFrames: 10,
        trimInSec: 0,
        speed: 1.0,
      } as any;

      tracks.set(`track-${t}`, {
        id: `track-${t}`,
        type: 'video',
        sequences: [seq],
      } as any);
    }

    const timeline: ResolvedTimeline = {
      meta: {
        canvasSize: { w: 320, h: 240 },
        globalFps: 30,
      },
      totalFrames: 10,
      tracks,
      assets,
    } as any;

    const renderer = new IRMasterRenderer(
      timeline,
      42,
      undefined,
      undefined,
      strictHardwareStrategy
    );

    // Prepare should not throw QuotaExceededError
    await renderer.prepare({ baseDir: '.' });

    const consumedFrames: number[] = [];
    const mockSink: IIRFrameSink = {
      initialize: async () => {},
      consumeFrame: async (f: number) => {
        consumedFrames.push(f);
      },
      finalize: async (): Promise<SinkFinalizeResult> => ({
        framesConsumed: consumedFrames.length,
        fileSizeBytes: 1024,
      }),
      dispose: async () => {},
    };

    // Render 10 frames across all 6 tracks
    const result = await renderer.render({
      sink: mockSink,
      skipAudio: true,
    });

    expect(result.totalFrames).toBe(10);
    expect(consumedFrames.length).toBe(10);
    // Verified: hardware decoders never exceeded quota (<= 4) at any time during export!
    expect(maxObservedDecoders).toBeLessThanOrEqual(4);
    // Verified: all decoders closed at completion
    expect(currentHardwareDecoders).toBe(0);
  });
});
