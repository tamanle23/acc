import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { MediabunnyWorkerReader } from '../apps/studio/src/renderer/workers/MediabunnyWorkerReader';

describe('MediabunnyWorkerReader In-Flight Deduplication & Concurrency Gate Suite', () => {
  let reader: MediabunnyWorkerReader;

  beforeEach(() => {
    reader = new MediabunnyWorkerReader('blob:mock-video-url');
  });

  it('initializes with default options and 0 active decodes', () => {
    expect(reader.src).toBe('blob:mock-video-url');
    expect(reader.getIsInitialized()).toBe(false);
  });

  it('deduplicates concurrent in-flight requests for the exact same frame', async () => {
    let resolveCanvas: (val: any) => void;
    const canvasPromise = new Promise((resolve) => {
      resolveCanvas = resolve;
    });

    // Mock internal canvasSink and initialization
    (reader as any).isInitialized = true;
    (reader as any).canvasSink = {
      getCanvas: mock(() => canvasPromise),
    };
    (reader as any).toImageBitmap = mock(async () => ({ width: 1920, height: 1080 } as any));

    // Issue two simultaneous requests for frame 10
    const req1 = reader.requestFrame(10, 30, false);
    const req2 = reader.requestFrame(10, 30, false);

    // Both requests must return the exact same Promise instance (in-flight deduplication)
    expect(req1).toBe(req2);

    // Verify canvasSink.getCanvas was called exactly once
    expect((reader as any).canvasSink.getCanvas).toHaveBeenCalledTimes(1);

    // Resolve decode
    resolveCanvas!({ canvas: {} });
    const result1 = await req1;
    const result2 = await req2;

    expect(result1).not.toBeNull();
    expect(result2).toBe(result1);
    expect((reader as any).activeDecodes).toBe(0);
  });

  it('enforces a hard concurrency limit (<= 2 active decodes) to prevent WebCodecs queue saturation', async () => {
    let resolvers: Array<(val: any) => void> = [];

    (reader as any).isInitialized = true;
    (reader as any).canvasSink = {
      getCanvas: mock(() => new Promise((resolve) => {
        resolvers.push(resolve);
      })),
    };
    (reader as any).toImageBitmap = mock(async () => ({ width: 1920, height: 1080 } as any));

    // Request frame 1 (active decode 1)
    const p1 = reader.requestFrame(1, 30, false);
    expect((reader as any).activeDecodes).toBe(1);

    // Request frame 2 (active decode 2)
    const p2 = reader.requestFrame(2, 30, false);
    expect((reader as any).activeDecodes).toBe(2);

    // Request frame 3 (exceeds MAX_CONCURRENT_DECODES=2) -> must return null gracefully
    const p3 = await reader.requestFrame(3, 30, false);
    expect(p3).toBeNull();
    expect((reader as any).activeDecodes).toBe(2);

    // Resolve frame 1
    resolvers[0]({ canvas: {} });
    await p1;
    expect((reader as any).activeDecodes).toBe(1);

    // Now request frame 4 -> slot is available
    const p4 = reader.requestFrame(4, 30, false);
    expect((reader as any).activeDecodes).toBe(2);

    resolvers[1]({ canvas: {} });
    resolvers[2]({ canvas: {} });
    await Promise.all([p2, p4]);
    expect((reader as any).activeDecodes).toBe(0);
  });
});
