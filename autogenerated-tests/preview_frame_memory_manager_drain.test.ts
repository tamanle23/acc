import { describe, it, expect, beforeEach } from 'bun:test';
import { PreviewFrameMemoryManager } from '../apps/studio/src/workers/PreviewFrameMemoryManager';

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

  it('stages evicted frames in pendingDisposal without closing them immediately on window pruning', () => {
    const bmp10 = createMockBitmap(10);
    const bmp100 = createMockBitmap(100);

    memoryManager.set('asset-1', 10, bmp10);
    memoryManager.set('asset-1', 100, bmp100);

    expect(memoryManager.size()).toBe(2);
    expect(memoryManager.getPendingDisposalCount()).toBe(0);

    // Prune outside window around playhead 10 at 30fps ([10 - 60, 10 + 90] => [-50, 100])
    // If playhead moves to 0 at 30fps: window is [0, 90]. Frame 100 is > 90 and should be evicted
    memoryManager.pruneOutsideWindow(0, 30);

    expect(memoryManager.get('asset-1', 100)).toBeNull();
    expect(memoryManager.get('asset-1', 10)).not.toBeNull();

    // Critical invariant: bmp100 is NOT closed yet! It is staged in pendingDisposal
    expect(bmp100.closed).toBe(false);
    expect(memoryManager.getPendingDisposalCount()).toBe(1);
  });

  it('drains disposal queue and closes bitmaps, while strictly sparing protected active bitmaps', () => {
    const bmp1 = createMockBitmap(1);
    const bmp2 = createMockBitmap(2);
    const bmp3 = createMockBitmap(3);

    memoryManager.set('asset-1', 1, bmp1);
    memoryManager.set('asset-1', 2, bmp2);
    memoryManager.set('asset-1', 3, bmp3);

    // Force evict all frames by pruning far away
    memoryManager.pruneOutsideWindow(500, 30);
    expect(memoryManager.size()).toBe(0);
    expect(memoryManager.getPendingDisposalCount()).toBe(3);

    // Drain queue with bmp2 protected (e.g. actively rendered by canvas compositor)
    const protectedSet = new Set<ImageBitmap>([bmp2]);
    memoryManager.drainDisposalQueue(protectedSet);

    // bmp1 and bmp3 should be closed synchronously
    expect(bmp1.closed).toBe(true);
    expect(bmp3.closed).toBe(true);

    // bmp2 was protected: must NOT be closed and remains staged for next drain
    expect(bmp2.closed).toBe(false);
    expect(memoryManager.getPendingDisposalCount()).toBe(1);

    // Subsequent drain without protection closes bmp2
    memoryManager.drainDisposalQueue();
    expect(bmp2.closed).toBe(true);
    expect(memoryManager.getPendingDisposalCount()).toBe(0);
  });

  it('evicts LRU when global budget (64 frames) is exceeded and stages for disposal', () => {
    const bitmaps: Array<ImageBitmap & { closed: boolean; id: number }> = [];

    // Fill up to max capacity
    for (let f = 0; f < 65; f++) {
      const bmp = createMockBitmap(f);
      bitmaps.push(bmp);
      memoryManager.set('asset-heavy', f, bmp);
    }

    // 64 items in memoryManager, 1 item evicted and staged for disposal
    expect(memoryManager.size()).toBe(64);
    expect(memoryManager.getPendingDisposalCount()).toBe(1);

    // Evicted item is frame 0
    expect(bitmaps[0].closed).toBe(false);

    memoryManager.drainDisposalQueue();
    expect(bitmaps[0].closed).toBe(true);
    expect(memoryManager.getPendingDisposalCount()).toBe(0);
  });
});
