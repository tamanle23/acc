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
});
