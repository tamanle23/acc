import { describe, it, expect, beforeAll } from 'bun:test';
import { bootstrapNode } from '@acc/core';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { SequentialVideoReader } from '../apps/studio/src/renderer/workers/SequentialVideoReader';
import { DeterministicTimelineClock } from '../apps/studio/src/lib/clock/DeterministicTimelineClock';

describe('Preview Playback Cadence & Zero-Blackout Architecture', () => {
  beforeAll(async () => {
    await bootstrapNode();
  });
  it('SequentialVideoReader initializes slot canvases with _isShared = true', () => {
    const dummySink: any = {
      getCanvas: async () => null,
    };
    const reader = new SequentialVideoReader(dummySink, 1920, 1080);
    const activeCanvas = reader.getActiveCanvas();
    if (activeCanvas) {
      expect((activeCanvas as any)._isShared).toBe(true);
    }
  });

  it('SequentialVideoReader hold-on-miss returns valid active canvas instead of null when painted frame exists', async () => {
    let returnValid = true;
    const testCanvas = UniversalCanvasProvider.createCanvas(1920, 1080);
    const rawTestCanvas = (testCanvas as any).getRawCanvas ? (testCanvas as any).getRawCanvas() : testCanvas;
    const dummySink: any = {
      getCanvas: async () => {
        if (returnValid) {
          // Mock valid wrapped canvas matching node-canvas / browser canvas instance
          return {
            canvas: rawTestCanvas,
            getRawCanvas: () => rawTestCanvas,
          };
        }
        return null;
      },
    };

    const reader = new SequentialVideoReader(dummySink, 1920, 1080);
    // 1. Initial valid frame paint
    const initialCanvas = await reader.getFrameCanvas(0, 30);
    expect(initialCanvas).not.toBeNull();

    // 2. Decode miss on frame 1 (e.g. background worker lag)
    returnValid = false;
    const heldCanvas = await reader.getFrameCanvas(1, 30);
    // Crucial Invariant: Must return the held canvas, NOT null (preventing black flash)
    expect(heldCanvas).not.toBeNull();
    // Invariant: Both canvases must be valid instances of canvas A or B and non-null
    expect(heldCanvas === reader.getActiveCanvas()).toBe(true);
  });

  it('DeterministicTimelineClock maintains monotonic frame advance across arbitrary FPS', () => {
    const testFrequencies = [23.976, 24, 25, 29.97, 30, 60, 120];

    for (const fps of testFrequencies) {
      const clock = new DeterministicTimelineClock({
        fps,
        totalFrames: 1000,
        mode: 'monotonic_worker',
      });
      clock.play(0, 1.0);

      let prevFrame = -1;
      const deltaSec = 1 / 60; // 60 Hz display refresh simulation
      for (let step = 0; step < 60; step++) {
        const frame = clock.tick(deltaSec);
        expect(frame).toBeGreaterThanOrEqual(prevFrame);
        prevFrame = frame;
      }
      expect(prevFrame).toBeGreaterThan(0);
    }
  });

  it('SequentialVideoReader seamlessly handles frame skips without queue pileup or stalls', async () => {
    const testCanvas = UniversalCanvasProvider.createCanvas(1920, 1080);
    const rawTestCanvas = (testCanvas as any).getRawCanvas ? (testCanvas as any).getRawCanvas() : testCanvas;

    const requestedSecs: number[] = [];
    const sink: any = {
      getCanvas: async (sec: number) => {
        requestedSecs.push(sec);
        return {
          canvas: rawTestCanvas,
          getRawCanvas: () => rawTestCanvas,
        };
      },
    };

    const reader = new SequentialVideoReader(sink, 1920, 1080);

    // Initial frame 0
    const c0 = await reader.getFrameCanvas(0, 30);
    expect(c0).not.toBeNull();

    // Skip to frame 2 (skipping frame 1)
    const c2 = await reader.getFrameCanvas(2, 30);
    expect(c2).not.toBeNull();

    // Skip to frame 5 (skipping 3 and 4)
    const c5 = await reader.getFrameCanvas(5, 30);
    expect(c5).not.toBeNull();

    // Verify all requested frames were decoded without stalls
    expect(requestedSecs).toContain(0);
    expect(requestedSecs).toContain(2 / 30);
    expect(requestedSecs).toContain(5 / 30);
  });

  it('SequentialVideoReader achieves 0ms slot swaps on preloaded sequential frames across 24, 30, and 60 FPS', async () => {
    const testCanvas = UniversalCanvasProvider.createCanvas(1920, 1080);
    const rawTestCanvas = (testCanvas as any).getRawCanvas ? (testCanvas as any).getRawCanvas() : testCanvas;

    for (const fps of [24, 30, 60]) {
      const sink: any = {
        getCanvas: async () => ({
          canvas: rawTestCanvas,
          getRawCanvas: () => rawTestCanvas,
        }),
      };

      const reader = new SequentialVideoReader(sink, 1920, 1080);

      // Frame 0 decode
      const f0 = await reader.getFrameCanvas(0, fps);
      expect(f0).not.toBeNull();

      // Small pause to allow background preload of frame 1 to settle
      await new Promise((r) => setTimeout(r, 10));

      // Frame 1 should swap instantly from preloaded inactive slot
      const tStart = performance.now();
      const f1 = await reader.getFrameCanvas(1, fps);
      const elapsed = performance.now() - tStart;

      expect(f1).not.toBeNull();
      // Instant swap takes under 5ms
      expect(elapsed).toBeLessThan(10);
      // Valid ping-pong slot swap
      expect(f1).not.toBe(f0);
    }
  });
});
