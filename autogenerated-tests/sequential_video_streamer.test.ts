import { describe, it, expect, beforeEach } from 'bun:test';
import { SequentialVideoReader } from '../apps/studio/src/renderer/workers/SequentialVideoReader';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native';

describe('SequentialVideoReader: Circular Ping-Pong Playback Streamer', () => {
  beforeEach(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
  });

  it('alternates between exactly 2 pre-allocated slots without new allocations across 50 frames', async () => {
    const width = 640;
    const height = 360;

    // Mock CanvasSink that returns a canvas on getCanvas(sec)
    let decodeCallCount = 0;
    const mockCanvas = UniversalCanvasProvider.createCanvas(width, height);
    const mockSink = {
      getCanvas: async (sec: number) => {
        decodeCallCount++;
        return mockCanvas;
      },
    };

    const reader = new SequentialVideoReader(mockSink as any, width, height);

    // Frame 0: paints active slot
    const c0 = await reader.getFrameCanvas(0, 30);
    expect(c0).toBeDefined();

    const initialCanvasA = (reader as any).canvasA;
    const initialCanvasB = (reader as any).canvasB;

    expect(initialCanvasA).toBeDefined();
    expect(initialCanvasB).toBeDefined();

    // Stream 50 sequential frames
    for (let frame = 1; frame <= 50; frame++) {
      const activeCanvas = await reader.getFrameCanvas(frame, 30);
      expect(activeCanvas).toBeDefined();
      // The active canvas MUST always be either initialCanvasA or initialCanvasB (zero new allocations)
      expect(activeCanvas === initialCanvasA || activeCanvas === initialCanvasB).toBe(true);
    }

    // Still exactly the original 2 instances
    expect((reader as any).canvasA).toBe(initialCanvasA);
    expect((reader as any).canvasB).toBe(initialCanvasB);

    reader.dispose();
    expect((reader as any).canvasA).toBeNull();
    expect((reader as any).canvasB).toBeNull();
  });
});
