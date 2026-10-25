import { describe, it, expect } from 'bun:test';
import { MediabunnyWorkerReader } from '../apps/studio/src/workers/MediabunnyWorkerReader';

describe('MediabunnyWorkerReader Lookahead Ring Buffer Suite', () => {
  it('initializes with default options and bounds ringBufferSize', () => {
    const reader = new MediabunnyWorkerReader('test.mp4', { ringBufferSize: 8 });
    expect(reader.src).toBe('test.mp4');
    expect(reader.getRingBufferFrames()).toEqual([]);
  });

  it('manages ring buffer frame insertion and tracks hot frames', () => {
    const reader = new MediabunnyWorkerReader('test.mp4', { ringBufferSize: 5 });

    let closeCount = 0;
    const createMockBitmap = (id: number) => ({
      width: 1920,
      height: 1080,
      close: () => {
        closeCount++;
      },
    } as unknown as ImageBitmap);

    // Manually inject frames via private access simulation
    (reader as any).setFrame(0, createMockBitmap(0));
    (reader as any).setFrame(1, createMockBitmap(1));
    (reader as any).setFrame(2, createMockBitmap(2));

    expect(reader.getFrame(0)).not.toBeNull();
    expect(reader.getFrame(1)).not.toBeNull();
    expect(reader.getFrame(5)).toBeNull();

    const frames = reader.getRingBufferFrames();
    expect(frames.sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it('evicts frames when ring buffer exceeds maximum capacity and closes ImageBitmap', () => {
    const reader = new MediabunnyWorkerReader('test.mp4', { ringBufferSize: 3 });

    let evictedCount = 0;
    let closedCount = 0;

    reader.onFrameEvicted = () => {
      evictedCount++;
    };

    const createMockBitmap = (id: number) => ({
      width: 1920,
      height: 1080,
      close: () => {
        closedCount++;
      },
    } as unknown as ImageBitmap);

    (reader as any).setFrame(10, createMockBitmap(10));
    (reader as any).setFrame(11, createMockBitmap(11));
    (reader as any).setFrame(12, createMockBitmap(12));
    expect(reader.getRingBufferFrames().length).toBe(3);

    // Adding 13 should evict frame 10 (furthest from 13)
    (reader as any).setFrame(13, createMockBitmap(13));
    expect(reader.getRingBufferFrames().length).toBe(3);
    expect(reader.getFrame(10)).toBeNull();
    expect(reader.getFrame(13)).not.toBeNull();
    expect(evictedCount).toBe(1);
    expect(closedCount).toBe(1);

    reader.dispose();
    expect(closedCount).toBe(4); // All remaining bitmaps closed
  });

  it('prunes frames falling outside lookahead window', () => {
    const reader = new MediabunnyWorkerReader('test.mp4', { ringBufferSize: 10 });
    let closedCount = 0;

    const mockBitmap = () => ({
      width: 100,
      height: 100,
      close: () => {
        closedCount++;
      },
    } as unknown as ImageBitmap);

    for (let f = 0; f <= 9; f++) {
      (reader as any).setFrame(f, mockBitmap());
    }

    expect(reader.getRingBufferFrames().length).toBe(10);

    // Prune outside [3, 7]
    reader.pruneOutsideWindow(3, 7);
    const remaining = reader.getRingBufferFrames().sort((a, b) => a - b);
    expect(remaining).toEqual([3, 4, 5, 6, 7]);
    expect(closedCount).toBe(5);

    reader.dispose();
  });
});
