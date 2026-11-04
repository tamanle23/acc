import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PlayheadController } from '../apps/studio/src/lib/playhead/PlayheadController';
import { WorkerRenderStrategy } from '../apps/studio/src/renderer/strategies/WorkerRenderStrategy';

const root = resolve(import.meta.dir, '..');
const read = (rel: string): string => readFileSync(resolve(root, rel), 'utf8');

describe('Iteration 60: preview playback smoothness', () => {
  it('Fractional Playhead Subscription: passes fractionalFrame on high-frequency ticks', () => {
    const ctrl = PlayheadController.getInstance();
    ctrl.setConfig(30, 300);
    const received: Array<[number, boolean, number | undefined]> = [];
    const unsub = ctrl.subscribeHighFrequency((f, p, frac) => {
      received.push([f, p, frac]);
    });
    ctrl.setIsPlaying(true);
    ctrl.seek(14, false, 14.48);
    ctrl.seek(9999, false, 9999.5); // clamp to totalFrames
    ctrl.seek(5); // fractional defaults to the clamped integer frame
    unsub();
    ctrl.setIsPlaying(false);

    expect(received.some(([f, p, frac]) => f === 14 && p && frac === 14.48)).toBe(true);
    expect(received.some(([f, , frac]) => f === 300 && frac === 300)).toBe(true);
    expect(received[received.length - 1]).toEqual([5, true, 5]);
  });

  it('Playback Render Exclusivity: React render pass returns early while isPlaying', () => {
    const src = read('apps/studio/src/components/preview/useViewportRenderStrategy.ts');
    const effectStart = src.indexOf('// Frame render pass');
    const guard = src.indexOf('if (isPlaying) {', effectStart);
    const render = src.indexOf('.syncTextures(', effectStart);
    expect(effectStart).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(effectStart);
    expect(guard).toBeLessThan(render);
  });

  it('Frame Deduplication: no duplicate worker messages for identical integer frames while playing', () => {
    const calls: number[] = [];
    const bridge = {
      hasTransferred: () => true,
      getIsReady: () => true,
      renderFrame: (f: number) => {
        calls.push(f);
      },
    } as unknown as ConstructorParameters<typeof WorkerRenderStrategy>[number];
    const strategy = new WorkerRenderStrategy(bridge);
    const playing = { isPlaying: true } as never;

    strategy.renderFrame(3, playing);
    strategy.renderFrame(3, playing);
    strategy.renderFrame(4, playing);
    strategy.renderFrame(4, playing);
    expect(calls).toEqual([3, 4]);

    // Parked renders are never deduplicated
    strategy.renderFrame(4, { isPlaying: false } as never);
    strategy.renderFrame(4, { isPlaying: false } as never);
    expect(calls).toEqual([3, 4, 4, 4]);
  });

  it('Virtual Scratch Canvas Sizing: scratch canvas requested at decoupled project resolution (scratchW, scratchH)', () => {
    const src = read('packages/ir/src/renderer/shared/IRCanvasCompositor.ts');
    expect(src).toContain('const scratchW = width;');
    expect(src).toContain('const scratchH = height;');
    expect(src).toContain('getFrameScratchContext(scratchW, scratchH)');
  });

  it('Worker readback: OffscreenCanvas uses willReadFrequently: true', () => {
    const src = read('apps/studio/src/renderer/workers/preview.worker.ts');
    expect(src).toContain('willReadFrequently: true');
    expect(src).not.toContain('willReadFrequently: false');
  });
});
