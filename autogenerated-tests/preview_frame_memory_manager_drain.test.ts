import { describe, it, expect, beforeEach } from 'bun:test';
import { PreviewFrameMemoryManager } from '../apps/studio/src/renderer/workers/PreviewFrameMemoryManager';

describe('PreviewFrameMemoryManager Post-Render Drain Queue & Eviction Suite', () => {
  let memoryManager: PreviewFrameMemoryManager;

  beforeEach(() => {
    memoryManager = PreviewFrameMemoryManager.getInstance();
    memoryManager.clear();
  });

  const createMockBitmap = (id: number) => {
    let isClosed = false;
    return {
      id,
      width: 1920,
      height: 1080,
      close: () => {
        isClosed = true;
      },
      get closed() {
        return isClosed;
      },
    } as unknown as ImageBitmap & { closed: boolean; id: number };
  };

  it('stores and retrieves frames by assetId and frame index', () => {
    const bmp = createMockBitmap(1);
    memoryManager.set('asset-video-1', 10, bmp);

    const retrieved = memoryManager.get('asset-video-1', 10);
    expect(retrieved).toBe(bmp);
    expect((retrieved as any).closed).toBe(false);
  });

  it('synchronously closes evicted frames on window pruning', () => {
    const bmp10 = createMockBitmap(10);
    const bmp100 = createMockBitmap(100);

    memoryManager.set('asset-1', 10, bmp10);
    memoryManager.set('asset-1', 100, bmp100);

    expect(memoryManager.size()).toBe(2);

    // Prune outside window around playhead 10 at 30fps ([10 - 60, 10 + 90] => [-50, 100])
    // If playhead moves to 0 at 30fps: window is [0, 90]. Frame 100 is > 90 and should be evicted
    memoryManager.pruneOutsideWindow(0, 30);

    expect(memoryManager.get('asset-1', 100)).toBeNull();
    expect(memoryManager.get('asset-1', 10)).not.toBeNull();

    // Critical invariant: bmp100 is closed synchronously upon pruning
    expect(bmp100.closed).toBe(true);
  });

  it('synchronously closes frames on pruneOutsideWindow and clear', () => {
    const bmp1 = createMockBitmap(1);
    const bmp2 = createMockBitmap(2);
    const bmp3 = createMockBitmap(3);

    memoryManager.set('asset-1', 1, bmp1);
    memoryManager.set('asset-1', 2, bmp2);
    memoryManager.set('asset-1', 3, bmp3);

    // Force evict all frames by pruning far away
    memoryManager.pruneOutsideWindow(500, 30);
    expect(memoryManager.size()).toBe(0);

    // bmp1, bmp2, bmp3 should be closed synchronously
    expect(bmp1.closed).toBe(true);
    expect(bmp2.closed).toBe(true);
    expect(bmp3.closed).toBe(true);
  });

  it('evicts LRU when global budget (32 frames) is exceeded and closes immediately', () => {
    const bitmaps: Array<ImageBitmap & { closed: boolean; id: number }> = [];

    // Fill up to max capacity of 32 + 1 extra
    for (let f = 0; f < 33; f++) {
      const bmp = createMockBitmap(f);
      bitmaps.push(bmp);
      memoryManager.set('asset-heavy', f, bmp);
    }

    // 32 items in memoryManager, 1 item evicted and closed synchronously
    expect(memoryManager.size()).toBe(32);

    // Evicted item is frame 0: must be closed immediately
    expect(bitmaps[0].closed).toBe(true);
    expect(bitmaps[1].closed).toBe(false);
  });
});
