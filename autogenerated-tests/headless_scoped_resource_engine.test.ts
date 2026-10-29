import { describe, it, expect, beforeEach } from 'bun:test';
import {
  NativeResourceManager,
  UniversalCanvasProvider,
  CanvasScratchPool,
} from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native';
import {
  IRMasterRenderer,
  IRCanvasCompositor,
  createIsolatedCoreModifierPlugins,
  type ResolvedTimeline,
  type ResolvedTrack,
  type ResolvedSequence,
} from '../packages/ir/src';
import { IRChunkWorkerPool } from '../packages/ir/src/server/IRChunkWorkerPool';

function createTestTimeline(options: {
  width?: number;
  height?: number;
  fps?: number;
  totalFrames: number;
  sequences: ResolvedSequence[];
}): ResolvedTimeline {
  const width = options.width ?? 640;
  const height = options.height ?? 360;
  const fps = options.fps ?? 30;
  const seqMap = new Map<string, ResolvedSequence>();
  for (const s of options.sequences) {
    seqMap.set(s.id, s);
  }

  const track: ResolvedTrack = {
    id: 'track-main',
    type: 'video',
    sequences: options.sequences,
    blendMode: 'normal',
    opacity: 1.0,
  };

  const tracks = new Map<string, ResolvedTrack>();
  tracks.set(track.id, track);

  return {
    meta: {
      version: '1.0.0',
      canvasSize: { w: width, h: height },
      globalFps: fps,
    },
    totalFrames: options.totalFrames,
    durationSeconds: options.totalFrames / fps,
    tracks,
    sequences: seqMap,
    assets: {},
  };
}

describe('Iteration 46: Headless Scoped Resource Engine & Deterministic Zero-Leak Exporter', () => {
  beforeEach(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
    CanvasScratchPool.getInstance().clear();
    const mgr = NativeResourceManager.getInstance();
    mgr.clear();
    mgr.setMaxGpuBytes(64 * 1024 * 1024);
  });

  it('Suite 1: 1,000-Frame Headless Soak Test flatlines native memory with 0 slope under ceiling', async () => {
    const sequences: ResolvedSequence[] = [];
    // 10 sequential clips of 100 frames each = 1,000 total frames
    for (let i = 0; i < 10; i++) {
      sequences.push({
        id: `seq-soak-${i}`,
        type: 'video',
        assetId: `asset-unique-${i}`,
        startFrame: i * 100,
        endFrame: (i + 1) * 100,
        durationFrames: 100,
        modifiers: [
          {
            id: `mod-cam-${i}`,
            type: 'vfx/camera3d',
            params: { fov: 55, pitch: 2, yaw: -1 },
          },
        ],
      });
    }

    const timeline = createTestTimeline({
      width: 320,
      height: 180,
      totalFrames: 1000,
      sequences,
    });

    const isolatedMgr = NativeResourceManager.createIsolated(64 * 1024 * 1024);
    const renderer = new IRMasterRenderer(timeline, 42, undefined, isolatedMgr);

    // Pre-register a simulated 1MB baked sequence texture on each sequence scope when its clip starts
    const registry = createIsolatedCoreModifierPlugins();
    const origCam = registry.get('vfx/camera3d')!;
    registry.register({
      ...origCam,
      type: 'vfx/camera3d',
      execute: async (ctx) => {
        const seq = ctx.targetEntity as ResolvedSequence;
        const scope = isolatedMgr.getOrCreateSequenceScope(seq.id);
        isolatedMgr.register(
          'baked-texture',
          { width: 512, height: 512, close: () => {} },
          { byteSize: 1024 * 1024, scope }
        );
      },
    });

    const rendererWithTrackedMods = new IRMasterRenderer(timeline, 42, registry, isolatedMgr);

    let bytesAtFrame50 = 0;
    let bytesAtFrame550 = 0;
    let bytesAtFrame950 = 0;
    let maxBytesObserved = 0;

    const result = await rendererWithTrackedMods.render({
      skipAudio: true,
      onProgress: ({ currentFrame }) => {
        const current = isolatedMgr.getCurrentBytes();
        if (current > maxBytesObserved) {
          maxBytesObserved = current;
        }
        if (currentFrame === 31) bytesAtFrame50 = current;
        if (currentFrame === 541) bytesAtFrame550 = current;
        if (currentFrame === 931) bytesAtFrame950 = current;
      },
    });

    expect(result.totalFrames).toBe(1000);
    // At any active frame inside a single clip, only 1 sequence scope (1MB) is resident (0 slope across 1,000 frames)
    expect(bytesAtFrame50).toBe(1024 * 1024);
    expect(bytesAtFrame550).toBe(1024 * 1024);
    expect(bytesAtFrame950).toBe(1024 * 1024);
    expect(maxBytesObserved).toBeLessThanOrEqual(2 * 1024 * 1024);

    // After final frame 1000 completes, all sequence scopes have been deterministically evicted
    expect(isolatedMgr.getCurrentBytes()).toBe(0);
    expect(isolatedMgr.getStats().scopeCount).toBe(0);
    renderer.dispose();
  });

  it('Suite 2: Hybrid Lookahead Eviction frees unique clips at out-point while retaining shared downstream assets', async () => {
    const sequences: ResolvedSequence[] = [
      {
        id: 'seq-unique',
        type: 'image',
        assetId: 'asset-only-once',
        startFrame: 0,
        endFrame: 10,
        durationFrames: 10,
      },
      {
        id: 'seq-shared-first',
        type: 'image',
        assetId: 'asset-reused-later',
        startFrame: 0,
        endFrame: 10,
        durationFrames: 10,
      },
      {
        id: 'seq-shared-second',
        type: 'image',
        assetId: 'asset-reused-later',
        startFrame: 20,
        endFrame: 30,
        durationFrames: 10,
      },
    ];

    const timeline = createTestTimeline({
      width: 320,
      height: 180,
      totalFrames: 30,
      sequences,
    });

    const mgr = NativeResourceManager.createIsolated(64 * 1024 * 1024);
    const renderer = new IRMasterRenderer(timeline, 42, undefined, mgr);

    // Register baked textures in both starting sequences
    const scopeUnique = mgr.getOrCreateSequenceScope('seq-unique');
    mgr.register('cutout', { width: 256, height: 256, close: () => {} }, { byteSize: 512 * 1024, scope: scopeUnique });

    const scopeShared1 = mgr.getOrCreateSequenceScope('seq-shared-first');
    mgr.register('cutout', { width: 256, height: 256, close: () => {} }, { byteSize: 512 * 1024, scope: scopeShared1 });

    // Render first half: frames 0..15 (past out-point 10 of first two sequences, before second shared clip at 20..30)
    await renderer.render({
      skipAudio: true,
      chunkStart: 0,
      chunkEnd: 15,
    });

    // 'seq-unique' out-point (10) passed and no downstream clip reuses 'asset-only-once' -> MUST be evicted!
    expect(mgr.hasSequenceScope('seq-unique')).toBe(false);
    expect(scopeUnique.isDisposed).toBe(true);

    // 'seq-shared-first' out-point (10) passed, BUT 'seq-shared-second' at 20..30 reuses 'asset-reused-later' -> MUST be retained!
    expect(mgr.hasSequenceScope('seq-shared-first')).toBe(true);
    expect(scopeShared1.isDisposed).toBe(false);

    // Now render second half: frames 15..30 (completing 'seq-shared-second' at frame 30)
    await renderer.render({
      skipAudio: true,
      chunkStart: 15,
      chunkEnd: 30,
    });

    // Both shared sequences have now passed final out-point (30) -> MUST be evicted!
    expect(mgr.hasSequenceScope('seq-shared-first')).toBe(false);
    expect(scopeShared1.isDisposed).toBe(true);
    expect(mgr.getCurrentBytes()).toBe(0);
  });

  it('Suite 3: Dynamic Resolution-Aware Budgeting scales ceiling for 1080p, 2K, 4K and honors maxMemoryMb override', async () => {
    expect(NativeResourceManager.computeResolutionBudgetBytes(1920, 1080)).toBe(64 * 1024 * 1024);
    expect(NativeResourceManager.computeResolutionBudgetBytes(2560, 1440)).toBe(128 * 1024 * 1024);
    expect(NativeResourceManager.computeResolutionBudgetBytes(3840, 2160)).toBe(256 * 1024 * 1024);
    expect(NativeResourceManager.computeResolutionBudgetBytes(3840, 2160, 96)).toBe(96 * 1024 * 1024);

    const timeline4K = createTestTimeline({
      width: 3840,
      height: 2160,
      totalFrames: 1,
      sequences: [],
    });

    const mgr4K = NativeResourceManager.createIsolated();
    const renderer4K = new IRMasterRenderer(timeline4K, 42, undefined, mgr4K);

    await renderer4K.render({ skipAudio: true, chunkStart: 0, chunkEnd: 0 });
    expect(mgr4K.getMaxGpuBytes()).toBe(256 * 1024 * 1024);

    await renderer4K.render({ skipAudio: true, chunkStart: 0, chunkEnd: 0, maxMemoryMb: 192 });
    expect(mgr4K.getMaxGpuBytes()).toBe(192 * 1024 * 1024);
  });

  it('Suite 4: Unified Compositor Frame-Level RAII Parity & Multi-Worker Chunk Isolation', async () => {
    const timeline = createTestTimeline({
      width: 320,
      height: 180,
      totalFrames: 20,
      sequences: [
        {
          id: 'seq-comp-1',
          type: 'video',
          startFrame: 0,
          endFrame: 20,
          durationFrames: 20,
        },
      ],
    });

    const canvasInstance = UniversalCanvasProvider.createCanvas(320, 180);
    const rawCanvas = canvasInstance.getRawCanvas ? canvasInstance.getRawCanvas() : canvasInstance;
    const ctx = rawCanvas.getContext('2d');

    const mgr = NativeResourceManager.createIsolated(64 * 1024 * 1024);
    const frameScope = mgr.createFrameScope('test-compositor-frame');
    let exitHookCalled = false;
    frameScope.onExit(() => {
      exitHookCalled = true;
    });

    await IRCanvasCompositor.renderFrame(ctx, timeline, 5, {
      pluginRegistry: createIsolatedCoreModifierPlugins(),
      executionProfile: 'master',
      frameScope,
      resourceManager: mgr,
    });

    // Borrowed scratch canvas should still be in use until caller disposes frameScope
    expect(CanvasScratchPool.getInstance().getStats().inUse).toBe(1);
    frameScope.dispose();
    expect(exitHookCalled).toBe(true);
    // Once frameScope disposes, scratch canvas is returned to pool (inUse === 0)
    expect(CanvasScratchPool.getInstance().getStats().inUse).toBe(0);

    // Verify IRChunkWorkerPool runs concurrent chunks with isolated budgets
    const pool = new IRChunkWorkerPool(timeline, 42);
    const poolResult = await pool.render({
      concurrency: 2,
      generateFrameHash: true,
      maxMemoryMb: 48,
    });

    expect(poolResult.totalFrames).toBe(20);
    expect(poolResult.chunkCount).toBe(2);
    expect(poolResult.chunkHashes.length).toBe(2);
  });
});
