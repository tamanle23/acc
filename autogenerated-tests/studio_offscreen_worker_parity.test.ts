import { describe, it, expect } from 'bun:test';
import {
  PreviewRenderWorkerCore,
  DecodedFrameCache,
  type FrameAckPayload,
} from '../apps/studio/src/lib/workers/PreviewRenderWorker';

describe('Studio Offscreen Canvas & Preview Worker Test Suite', () => {
  it('manages LRU ring buffer with forward and backward limits', () => {
    const cache = new DecodedFrameCache(10, 5); // 10 forward, 5 backward

    for (let f = 0; f < 30; f++) {
      cache.set(f, { frame: f });
    }

    // At frame 29, frames < 24 (29 - 5) should be pruned
    expect(cache.has(0)).toBe(false);
    expect(cache.has(10)).toBe(false);
    expect(cache.has(28)).toBe(true);
    expect(cache.has(29)).toBe(true);
  });

  it('processes worker messages and acknowledges rendered frames', () => {
    const worker = new PreviewRenderWorkerCore();
    const acks: FrameAckPayload[] = [];

    // Mock canvas context
    const mockCtx = {
      clearRect: () => {},
      fillRect: () => {},
      save: () => {},
      restore: () => {},
    };

    const mockCanvas = {
      getContext: () => mockCtx,
      width: 1920,
      height: 1080,
    };

    worker.handleMessage(
      {
        type: 'INIT',
        canvas: mockCanvas,
        width: 1920,
        height: 1080,
        fps: 30,
      },
      (ack) => acks.push(ack)
    );

    // Dispatch normal frame 0
    worker.handleMessage(
      {
        type: 'DISPATCH_FRAME',
        frame: 0,
        speed: 1.0,
      },
      (ack) => acks.push(ack)
    );

    expect(acks.length).toBe(1);
    expect(acks[0].frame).toBe(0);
    expect(acks[0].lod).toBe(1.0);
    expect(worker.getLastRenderedFrame()).toBe(0);

    // Dispatch high-speed scrub (>3x speed) -> should engage 0.5x LOD
    worker.handleMessage(
      {
        type: 'DISPATCH_FRAME',
        frame: 45,
        speed: 4.0,
      },
      (ack) => acks.push(ack)
    );

    expect(acks.length).toBe(2);
    expect(acks[1].frame).toBe(45);
    expect(acks[1].lod).toBe(0.5); // Dynamic Scrub LOD engaged
    expect(worker.getLastRenderedFrame()).toBe(45);
  });
});
