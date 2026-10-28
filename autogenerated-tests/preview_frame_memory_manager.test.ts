import { describe, it, expect, beforeEach } from 'bun:test';
import { PreviewFrameMemoryManager } from '../apps/studio/src/renderer/workers/PreviewFrameMemoryManager';

describe('PreviewFrameMemoryManager Suite', () => {
  let memoryManager: PreviewFrameMemoryManager;

  beforeEach(() => {
    memoryManager = PreviewFrameMemoryManager.getInstance();
    memoryManager.clear();
  });

  it('stores and retrieves frames correctly while updating access timestamp', () => {
    const mockBitmap = {
      width: 1920,
      height: 1080,
      close: () => { },
    } as unknown as ImageBitmap;

    memoryManager.set('asset-1', 42, mockBitmap);
    expect(memoryManager.size()).toBe(1);
    expect(memoryManager.get('asset-1', 42)).toBe(mockBitmap);
    expect(memoryManager.get('asset-1', 99)).toBeNull();
  });

  it('enforces global frame ceiling of 32 frames and evicts oldest items with .close()', () => {
    let closedCount = 0;
    const createBitmap = (id: number) => ({
      width: 1920,
      height: 1080,
      close: () => {
        closedCount++;
      },
    } as unknown as ImageBitmap);

    // Fill up to ceiling of 32
    for (let i = 0; i < 32; i++) {
      memoryManager.set('asset-1', i, createBitmap(i));
    }
    expect(memoryManager.size()).toBe(32);
    expect(closedCount).toBe(0);

    // Access frame 0 so it is NOT the least recently used
    memoryManager.get('asset-1', 0);

    // Adding 33rd frame should evict frame 1 and synchronously close it
    memoryManager.set('asset-1', 100, createBitmap(100));
    expect(memoryManager.size()).toBe(32);
    expect(closedCount).toBe(1); // One frame closed synchronously!
    expect(memoryManager.get('asset-1', 1)).toBeNull();
    expect(memoryManager.get('asset-1', 0)).not.toBeNull();
  });

  it('prunes frames falling outside [playhead - 2s, playhead + 3s] and closes them synchronously', () => {
    let closedCount = 0;
    const createBitmap = () => ({
      width: 1920,
      height: 1080,
      close: () => {
        closedCount++;
      },
    } as unknown as ImageBitmap);

    const fps = 30;
    // Playhead is at frame 100:
    // Window: [100 - 60, 100 + 90] = [40, 190]
    memoryManager.set('asset-1', 20, createBitmap()); // Should be pruned (< 40)
    memoryManager.set('asset-1', 50, createBitmap()); // Kept
    memoryManager.set('asset-1', 100, createBitmap()); // Kept
    memoryManager.set('asset-1', 180, createBitmap()); // Kept
    memoryManager.set('asset-1', 250, createBitmap()); // Should be pruned (> 190)

    expect(memoryManager.size()).toBe(5);
    memoryManager.pruneOutsideWindow(100, fps);

    expect(memoryManager.size()).toBe(3);
    expect(closedCount).toBe(2);
    expect(memoryManager.get('asset-1', 20)).toBeNull();
    expect(memoryManager.get('asset-1', 250)).toBeNull();
    expect(memoryManager.get('asset-1', 100)).not.toBeNull();
  });
});
