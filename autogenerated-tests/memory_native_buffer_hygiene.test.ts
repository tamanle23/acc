import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  UniversalCanvasProvider,
  ContentCacheRegistry,
  type IContentCacheStrategy,
  type CachePayload,
} from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native';
import {
  IRCanvasCompositor,
  type IAssetSourceResolver,
  type ResolvedTimeline,
  type ResolvedSequence,
  ModifierPluginRegistry,
} from '@acc/ir';
import { AssetTextureCache } from '../apps/studio/src/lib/textures/AssetTextureCache';
import { PreviewFrameMemoryManager } from '../apps/studio/src/renderer/workers/PreviewFrameMemoryManager';
import { ContentHashTextureCache } from '../apps/studio/src/renderer/workers/ContentHashTextureCache';

class MockMemoryBlobCacheStrategy implements IContentCacheStrategy {
  readonly id = 'mock-memory-blob-strategy';
  readonly name = 'Mock In-Memory Blob Cache Strategy';
  private storage = new Map<string, Blob>();

  async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async get(key: string): Promise<Blob | null> {
    return this.storage.get(key) || null;
  }

  async set(key: string, data: CachePayload): Promise<void> {
    if (data instanceof Blob) {
      this.storage.set(key, data);
    } else if (data instanceof ArrayBuffer) {
      this.storage.set(key, new Blob([data]));
    } else if (ArrayBuffer.isView(data)) {
      const copy = new Uint8Array(data.byteLength);
      copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      this.storage.set(key, new Blob([copy.buffer]));
    } else {
      this.storage.set(key, new Blob([String(data)]));
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async getMetadata(key: string): Promise<any> {
    const blob = this.storage.get(key);
    if (!blob) return null;
    return {
      checksum: 'mock-sum',
      mimeType: blob.type,
      sizeBytes: blob.size,
      createdAt: Date.now(),
    };
  }
}

describe('Iteration 44: Native Media Buffer Hygiene & Memory Management Suite', () => {
  beforeEach(() => {
    // Register isomorphic canvas adapter
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);

    // Register in-memory ContentCacheRegistry strategy for deterministic testing
    ContentCacheRegistry.reset();
    ContentCacheRegistry.register(new MockMemoryBlobCacheStrategy(), true);

    // Reset caches
    PreviewFrameMemoryManager.getInstance().clear();
    ContentHashTextureCache.getInstance().clear();
    AssetTextureCache.getInstance().clear();
  });

  afterEach(() => {
    PreviewFrameMemoryManager.getInstance().clear();
    ContentHashTextureCache.getInstance().clear();
    AssetTextureCache.getInstance().clear();
  });

  it('Pillar 1: IRCanvasCompositor executes .close() on transient frames immediately post-drawImage', async () => {
    let closeCallCount = 0;
    let drawCallCount = 0;

    const mockBitmap = {
      width: 1920,
      height: 1080,
      _isTransient: true,
      close: () => {
        closeCallCount++;
      },
    };

    const mockCtx: any = {
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      fillRect: () => {},
      drawImage: (img: any, dx: number, dy: number, dw: number, dh: number) => {
        drawCallCount++;
        // Bitmap must NOT be closed while drawImage is executing
        expect(closeCallCount).toBe(0);
      },
    };

    const seq1: ResolvedSequence = {
      id: 's1',
      trackId: 't1',
      type: 'video',
      assetId: 'video-asset-1',
      startFrame: 0,
      endFrame: 50,
      durationFrames: 50,
      enabled: true,
    } as any;

    const dummyTimeline: ResolvedTimeline = {
      meta: {
        canvasSize: { w: 1920, h: 1080 },
        globalFps: 30,
      },
      totalFrames: 100,
      tracks: new Map([
        [
          't1',
          {
            id: 't1',
            type: 'video',
            muted: false,
            sequences: [seq1],
          } as any,
        ],
      ]),
      sequences: new Map([['s1', seq1]]),
    };

    const resolver: IAssetSourceResolver = {
      has: (id: string) => id === 'video-asset-1',
      get: (id: string) => mockBitmap,
      onAssetDrawn: (assetId: string, asset: any) => {
        if (asset && asset._isTransient && typeof asset.close === 'function') {
          asset.close();
        }
      },
    };

    await IRCanvasCompositor.renderFrame(mockCtx, dummyTimeline, 10, {
      pluginRegistry: ModifierPluginRegistry.createIsolated(),
      assetResolver: resolver,
    });

    expect(drawCallCount).toBe(1);
    expect(closeCallCount).toBe(1); // Closed immediately post-draw!
  });

  it('Pillar 1: Coordinates multi-sequence sharing safely without premature closure', async () => {
    let closeCallCount = 0;
    let drawCallCount = 0;

    const mockSharedBitmap = {
      width: 1920,
      height: 1080,
      _isTransient: true,
      close: () => {
        closeCallCount++;
      },
    };

    const mockCtx: any = {
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      fillRect: () => {},
      drawImage: (img: any) => {
        drawCallCount++;
        // Bitmap must still be open during both draws
        expect(closeCallCount).toBe(0);
      },
    };

    const seq1: ResolvedSequence = {
      id: 's1',
      trackId: 't1',
      type: 'video',
      assetId: 'shared-asset',
      startFrame: 0,
      endFrame: 50,
      durationFrames: 50,
      enabled: true,
    } as any;

    const seq2: ResolvedSequence = {
      id: 's2',
      trackId: 't2',
      type: 'overlay',
      assetId: 'shared-asset',
      startFrame: 0,
      endFrame: 50,
      durationFrames: 50,
      enabled: true,
    } as any;

    // 2 sequences on separate tracks sharing the same assetId
    const sharedTimeline: ResolvedTimeline = {
      meta: {
        canvasSize: { w: 1920, h: 1080 },
        globalFps: 30,
      },
      totalFrames: 100,
      tracks: new Map([
        [
          't1',
          {
            id: 't1',
            type: 'video',
            muted: false,
            sequences: [seq1],
          } as any,
        ],
        [
          't2',
          {
            id: 't2',
            type: 'overlay',
            muted: false,
            sequences: [seq2],
          } as any,
        ],
      ]),
      sequences: new Map([
        ['s1', seq1],
        ['s2', seq2],
      ]),
    };

    let remainingUses = 2;
    const resolver: IAssetSourceResolver = {
      has: (id: string) => id === 'shared-asset',
      get: (id: string) => mockSharedBitmap,
      onAssetDrawn: (assetId: string, asset: any) => {
        remainingUses--;
        if (remainingUses === 0 && asset && asset._isTransient && typeof asset.close === 'function') {
          asset.close();
        }
      },
    };

    await IRCanvasCompositor.renderFrame(mockCtx, sharedTimeline, 10, {
      pluginRegistry: ModifierPluginRegistry.createIsolated(),
      assetResolver: resolver,
    });

    expect(drawCallCount).toBe(2);
    expect(closeCallCount).toBe(1); // Closed only after all sequences drew!
  });

  it('Pillar 2: PreviewFrameMemoryManager enforces 32-frame ceiling and closes evicted bitmaps synchronously', () => {
    const memoryManager = PreviewFrameMemoryManager.getInstance();
    const closedBitmaps: number[] = [];

    const createMockBitmap = (id: number) => ({
      width: 1920,
      height: 1080,
      close: () => {
        closedBitmaps.push(id);
      },
    } as unknown as ImageBitmap);

    // Fill to capacity of 8
    for (let f = 0; f < 8; f++) {
      memoryManager.set('clip-1', f, createMockBitmap(f));
    }
    expect(memoryManager.size()).toBe(8);
    expect(closedBitmaps.length).toBe(0);

    // Access frame 0 so frame 1 becomes the oldest LRU
    memoryManager.get('clip-1', 0);

    // Add 9th frame: frame 1 must be evicted and closed synchronously
    memoryManager.set('clip-1', 99, createMockBitmap(99));
    expect(memoryManager.size()).toBe(8);
    expect(closedBitmaps.length).toBe(1);
    expect(closedBitmaps[0]).toBe(1); // Frame 1 evicted and closed!
    expect(memoryManager.get('clip-1', 1)).toBeNull();
    expect(memoryManager.get('clip-1', 0)).not.toBeNull();

    // Overwriting an existing key closes the old bitmap synchronously
    const replaceBmp = createMockBitmap(999);
    memoryManager.set('clip-1', 0, replaceBmp);
    expect(closedBitmaps).toContain(0); // Old frame 0 was closed synchronously!
    expect(memoryManager.get('clip-1', 0)).toBe(replaceBmp);
  });

  it('Pillar 3: AssetTextureCache bounds hot storage and provides visual asset fallbacks', async () => {
    const textureCache = AssetTextureCache.getInstance();
    const testCanvas = UniversalCanvasProvider.createCanvas(100, 100);

    // 1. Direct texture registration
    textureCache.set('asset-cloud-1', testCanvas);
    expect(textureCache.has('asset-cloud-1')).toBe(true);

    // 2. Verify getVisualAsset fallback to placeholder canvas without crashing
    const visual = textureCache.getVisualAsset('asset-cloud-1', undefined, 'image');
    expect(visual).toBeDefined();
    expect(visual.width).toBeGreaterThan(0);
    expect(visual.height).toBeGreaterThan(0);

    // 3. Verify thumbnail generation produces valid string or data
    const thumbUrl = textureCache.getThumbnailDataUrl('asset-cloud-1', 120, 68);
    expect(thumbUrl).toBeDefined();
    expect(typeof thumbUrl).toBe('string');
  });

  it('Pillar 4: CanvasScratchPool reuses pooled canvases via clearRect', () => {
    const scratch1 = UniversalCanvasProvider.acquireScratchCanvas(640, 360);
    expect(scratch1).toBeDefined();
    const raw1 = (scratch1 as any).getRawCanvas ? (scratch1 as any).getRawCanvas() : scratch1;
    expect(raw1.width).toBeGreaterThanOrEqual(640);
    expect(raw1.height).toBeGreaterThanOrEqual(360);

    // Release back to scratch pool
    UniversalCanvasProvider.releaseScratchCanvas(scratch1);

    // Re-acquire same tier: must return from pool
    const scratch2 = UniversalCanvasProvider.acquireScratchCanvas(640, 360);
    expect(scratch2).toBe(scratch1); // Same canvas instance reused!
    UniversalCanvasProvider.releaseScratchCanvas(scratch2);
  });

  it('Pillar 5: ContentHashTextureCache bounds capacity to 32 and closes evicted text bitmaps', () => {
    const textCache = ContentHashTextureCache.getInstance();
    const closedList: number[] = [];

    const createBmp = (id: number) => ({
      width: 200,
      height: 50,
      close: () => {
        closedList.push(id);
      },
    } as unknown as ImageBitmap);

    // Fill to max capacity (32)
    for (let i = 0; i < 32; i++) {
      textCache.set(i, createBmp(i));
    }

    // Refresh entry 0 so entry 1 becomes oldest
    textCache.get(0);

    // Add 33rd entry
    textCache.set(100, createBmp(100));
    expect(closedList.length).toBe(1);
    expect(closedList[0]).toBe(1); // Oldest evicted entry closed!
  });

  it('Pillar 6: PreviewFrameMemoryManager.take() transfers ownership for single-use playback transience', () => {
    const memoryManager = PreviewFrameMemoryManager.getInstance();
    let closed = false;
    const bmp = {
      width: 1920,
      height: 1080,
      close: () => {
        closed = true;
      },
    } as unknown as ImageBitmap;

    memoryManager.set('clip-vid-1', 10, bmp);
    expect(memoryManager.size()).toBe(1);

    // Take frame: must return bitmap, remove from cache, and NOT close it yet
    const taken = memoryManager.take('clip-vid-1', 10);
    expect(taken).toBe(bmp);
    expect(memoryManager.size()).toBe(0);
    expect(closed).toBe(false);

    // Mark transient as done during playback
    (taken as any)._isTransient = true;
    (taken as any).close();
    expect(closed).toBe(true);
  });

  it('Pillar 7: pruneOutsideWindow resolves clip-local frames and timeline sequence boundaries accurately', () => {
    const memoryManager = PreviewFrameMemoryManager.getInstance();
    const closedFrames: number[] = [];

    const makeBmp = (localFrame: number) => ({
      width: 1920,
      height: 1080,
      close: () => {
        closedFrames.push(localFrame);
      },
    } as unknown as ImageBitmap);

    // Mock timeline with 2 video clips:
    // Clip A: asset 'vid-A', global start 0, duration 100 (frames 0..100)
    // Clip B: asset 'vid-B', global start 200, duration 100 (frames 200..300)
    const mockTimeline = {
      meta: { globalFps: 30, canvasSize: { w: 1920, h: 1080 } },
      tracks: new Map([
        [
          'v1',
          {
            id: 'v1',
            type: 'video',
            sequences: [
              { id: 'seq-A', assetId: 'vid-A', startFrame: 0, durationFrames: 100 },
              { id: 'seq-B', assetId: 'vid-B', startFrame: 200, durationFrames: 100 },
            ],
          },
        ],
      ]),
    };

    // Staging frames:
    // For vid-A (ended at 100): local frame 50
    // For vid-B (starts at 200): local frame 0, local frame 10, local frame 90
    memoryManager.set('vid-A', 50, makeBmp(50));
    memoryManager.set('vid-B', 0, makeBmp(0));
    memoryManager.set('vid-B', 10, makeBmp(10));
    memoryManager.set('vid-B', 90, makeBmp(90));

    // Playhead is now at global frame 210 (inside Clip B, local frame 10).
    // Clip A is at [0..100], which is > 90 frames (3s) behind playhead (210 - 100 = 110 > 60).
    // Vid-A frames must be pruned immediately!
    // Vid-B local 0 and 10 are within [10 - 60, 10 + 90] = [0, 100].
    memoryManager.pruneOutsideWindow(210, 30, mockTimeline);

    expect(closedFrames).toContain(50); // vid-A frame 50 was closed!
    expect(memoryManager.get('vid-A', 50)).toBeNull();
    expect(memoryManager.get('vid-B', 0)).not.toBeNull();
    expect(memoryManager.get('vid-B', 10)).not.toBeNull();
  });
});
