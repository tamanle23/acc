import { describe, it, expect, beforeAll } from 'bun:test';
import { bootstrapNode } from '@acc/core';
import { PreviewWorkerBridge } from '../apps/studio/src/renderer/workers/PreviewWorkerBridge';
import { SequentialVideoReader } from '../apps/studio/src/renderer/workers/SequentialVideoReader';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';

describe('Studio Offscreen Canvas & Preview Worker Real Architecture Test Suite', () => {
  beforeAll(async () => {
    await bootstrapNode();
  });
  it('manages PreviewWorkerBridge singleton and lifecycle subscription listeners', () => {
    const bridge1 = PreviewWorkerBridge.getInstance();
    const bridge2 = PreviewWorkerBridge.getInstance();
    expect(bridge1).toBe(bridge2);

    expect(typeof bridge1.renderFrame).toBe('function');
    expect(typeof bridge1.updateTimeline).toBe('function');
    expect(typeof bridge1.resize).toBe('function');
    expect(typeof bridge1.addMessageListener).toBe('function');

    let listenerCalled = false;
    const unsub = bridge1.addMessageListener(() => {
      listenerCalled = true;
    });
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('guarantees SequentialVideoReader isolates mutations to inactive slot and preserves active slot', async () => {
    const reader = new SequentialVideoReader(null, 1920, 1080);
    const initialSlot = reader.getActiveCanvas();
    expect(initialSlot).not.toBeNull();
    expect((initialSlot as any)._isShared).toBe(true);

    // Initial state: inactive slot is different from active slot
    const inactiveSlot = reader.getInactiveSlot();
    expect(inactiveSlot).toBe('B');

    // On miss/error with no sink, getFrameCanvas returns null initially (frame -1)
    const result = await reader.getFrameCanvas(0, 30);
    expect(result).toBeNull();

    // Now inject a mock canvas sink that returns a valid canvas
    const sampleCanvas = UniversalCanvasProvider.createCanvas(1920, 1080);
    let getCanvasCallCount = 0;
    const mockSink = {
      getCanvas: async (_sec: number) => {
        getCanvasCallCount++;
        return {
          canvas: (sampleCanvas as any).canvas || sampleCanvas,
          timestamp: _sec,
          duration: 1 / 30,
        };
      },
    };

    const readerWithSink = new SequentialVideoReader(mockSink as any, 1920, 1080);
    const canvasBefore = readerWithSink.getActiveCanvas();

    // First decode: paints inactive slot and swaps
    const canvasAfter = await readerWithSink.getFrameCanvas(0, 30);
    expect(canvasAfter).not.toBeNull();
    // Verify slot swap occurred
    expect(canvasAfter).not.toBe(canvasBefore);
    expect(getCanvasCallCount).toBeGreaterThanOrEqual(1);

    // Verify hold-on-miss: simulate sink failure on a future frame
    const failingSink = {
      getCanvas: async () => {
        throw new Error('WebCodecs iterator failure');
      },
    };
    (readerWithSink as any).canvasSink = failingSink;

    // Decoding frame 99 fails, but hold-on-miss returns the active canvas untouched
    const heldCanvas = await readerWithSink.getFrameCanvas(99, 30);
    expect(heldCanvas).toBe(canvasAfter);
    expect(heldCanvas).toBe(readerWithSink.getActiveCanvas());
  });

  it('serializes concurrent canvasSink decode requests without throwing', async () => {
    let concurrentCalls = 0;
    let maxConcurrent = 0;
    const sampleCanvas = UniversalCanvasProvider.createCanvas(1920, 1080);

    const serializedSink = {
      getCanvas: async (_sec: number) => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise((r) => setTimeout(r, 10));
        concurrentCalls--;
        return {
          canvas: (sampleCanvas as any).canvas || sampleCanvas,
          timestamp: _sec,
          duration: 1 / 30,
        };
      },
    };

    const reader = new SequentialVideoReader(serializedSink as any, 1920, 1080);

    // Dispatch 4 concurrent requests
    await Promise.all([
      reader.getFrameCanvas(1, 30),
      reader.getFrameCanvas(2, 30),
      reader.getFrameCanvas(3, 30),
      reader.getFrameCanvas(4, 30),
    ]);

    // Mutex queue ensures CanvasSink is NEVER called concurrently (max concurrency === 1)
    expect(maxConcurrent).toBe(1);
    // Allow background preloadNext to settle
    await new Promise((r) => setTimeout(r, 25));
    expect(concurrentCalls).toBe(0);
  });
});
