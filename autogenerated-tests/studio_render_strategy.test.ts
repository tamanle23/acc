import { describe, it, expect } from 'bun:test';
import type { ResolvedTimeline } from '@acc/ir';
import {
  createPreviewRenderStrategy,
  WorkerRenderStrategy,
  MainThreadRenderStrategy,
} from '@acc/studio/renderer';

describe('Iteration 40 Phase 2: Render Strategy Abstraction', () => {
  const dummyTimeline: ResolvedTimeline = {
    meta: { durationFrames: 100, fps: 30 },
    tracks: new Map(),
    sequences: new Map(),
  };

  it('createPreviewRenderStrategy instantiates MainThreadRenderStrategy in headless runtime', () => {
    const strategy = createPreviewRenderStrategy();
    expect(strategy).toBeDefined();
    expect(strategy.id).toBe('main-thread');
  });

  it('createPreviewRenderStrategy respects preferMainThread option', () => {
    const strategy = createPreviewRenderStrategy({ preferMainThread: true });
    expect(strategy.id).toBe('main-thread');
  });

  it('MainThreadRenderStrategy updates timeline and disposes gracefully', () => {
    const strategy = new MainThreadRenderStrategy();
    expect(strategy.isReady).toBe(false);

    let readyTriggered = false;
    strategy.onReady(() => {
      readyTriggered = true;
    });

    const mockCanvas = {
      width: 1920,
      height: 1080,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;

    const initialized = strategy.init(mockCanvas);
    expect(initialized).toBe(true);
    expect(strategy.isReady).toBe(true);
    expect(readyTriggered).toBe(true);

    strategy.updateTimeline(dummyTimeline, 100, 30);
    expect(strategy.getEngine()).toBeDefined();

    strategy.dispose();
    expect(strategy.isReady).toBe(false);
    expect(strategy.getEngine()).toBeNull();
  });

  it('WorkerRenderStrategy provides clean interface contracts', () => {
    const workerStrategy = new WorkerRenderStrategy();
    expect(workerStrategy.id).toBe('worker');
    expect(workerStrategy.isReady).toBe(false);

    workerStrategy.updateTimeline(dummyTimeline, 100, 30);
    workerStrategy.resize(1280, 720);
    workerStrategy.dispose();
    expect(workerStrategy.isReady).toBe(false);
  });
});
