import { describe, it, expect, beforeAll } from 'bun:test';
import { ContentCacheRegistry } from '@acc/core-isomorphic';
import type { IMediaEngineStrategy, IContentCacheStrategy } from '@acc/core-isomorphic';
import type { ResolvedTimeline, ResolvedTrack } from '../packages/ir/src/types/VideoIR';
import { IRMasterRenderer } from '../packages/ir/src/renderer/IRMasterRenderer';

/** Minimal in-memory cache so the test has no dependency on native adapters. */
function createMemoryCache(): IContentCacheStrategy {
  const store = new Map<string, Blob>();
  return {
    id: 'memory-test',
    name: 'Memory Test Cache',
    has: async (k: string) => store.has(k),
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, d: unknown) => {
      store.set(k, d as Blob);
    },
  } as unknown as IContentCacheStrategy;
}

function buildVideoTimeline(): ResolvedTimeline {
  const track: ResolvedTrack = {
    id: 'track_1',
    name: 'Main',
    type: 'video',
    order: 0,
    sequences: [
      {
        id: 'seq_1',
        name: 'Seq 1',
        type: 'video',
        startFrame: 0,
        endFrame: 10,
        durationFrames: 10,
        timelineStartFrame: 0,
      },
    ],
  };
  return {
    id: 'strategy-injection-timeline',
    version: '1.0.0',
    durationSeconds: 10 / 30,
    totalFrames: 10,
    meta: { canvasSize: { w: 320, h: 240 }, globalFps: 30 },
    tracks: new Map([['track_1', track]]),
    sequences: new Map([['seq_1', track.sequences[0]]]),
    assets: { clip: { type: 'video', src: '/abs/path/clip.mp4' } },
  } as ResolvedTimeline;
}

describe('IRMasterRenderer constructor-injected MediaEngineStrategy', () => {
  beforeAll(() => {
    ContentCacheRegistry.register(createMemoryCache(), true);
  });

  it('uses the injected strategy to create and open video decoders', async () => {
    const calls: Array<{ path: string; w: number; h: number }> = [];
    let closed = false;
    const strategy = {
      createVideoDecoder: (path: string, w: number, h: number) => {
        calls.push({ path, w, h });
        return { open: async () => true, close: () => { closed = true; } };
      },
    } as unknown as IMediaEngineStrategy;

    const renderer = new IRMasterRenderer(buildVideoTimeline(), 42, undefined, undefined, strategy);
    await renderer.prepare({ baseDir: '.' });

    expect(calls).toEqual([{ path: '/abs/path/clip.mp4', w: 320, h: 240 }]);
    expect((renderer as any).videoDecoders.has('clip')).toBe(true);
    expect(closed).toBe(false);
  });

  it('does not throw and skips video decoders when no strategy is injected', async () => {
    const renderer = new IRMasterRenderer(buildVideoTimeline());
    await expect(renderer.prepare({ baseDir: '.' })).resolves.toBeUndefined();
    expect((renderer as any).videoDecoders.size).toBe(0);
  });

  it('keeps a failing decoder.open() non-fatal', async () => {
    const strategy = {
      createVideoDecoder: () => ({ open: async () => false, close: () => {} }),
    } as unknown as IMediaEngineStrategy;
    const renderer = new IRMasterRenderer(buildVideoTimeline(), 42, undefined, undefined, strategy);
    await renderer.prepare({ baseDir: '.' });
    expect((renderer as any).videoDecoders.size).toBe(0);
  });

  it('supports deprecated preloadAssets as an alias to prepare', async () => {
    const calls: Array<{ path: string; w: number; h: number }> = [];
    const strategy = {
      createVideoDecoder: (path: string, w: number, h: number) => {
        calls.push({ path, w, h });
        return { open: async () => true, close: () => {} };
      },
    } as unknown as IMediaEngineStrategy;

    const renderer = new IRMasterRenderer(buildVideoTimeline(), 42, undefined, undefined, strategy);
    await renderer.preloadAssets('.');
    expect(calls.length).toBe(1);
    expect((renderer as any).videoDecoders.has('clip')).toBe(true);
  });

  it('no longer performs ad-hoc MediaEngineRegistry lookups in the renderer source', async () => {
    const fsModule = await import('fs');
    const pathModule = await import('path');
    const src = fsModule.readFileSync(
      pathModule.resolve(import.meta.dir, '../packages/ir/src/renderer/IRMasterRenderer.ts'),
      'utf-8'
    );
    expect(src).not.toContain('MediaEngineRegistry');
  });
});
