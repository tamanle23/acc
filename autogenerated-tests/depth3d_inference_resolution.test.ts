import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { Depth3DPlugin } from '../packages/ir/src/plugins/vfx/Depth3DPlugin';
import { StudioSidecarCoordinator } from '../apps/studio/src/renderer/StudioSidecarCoordinator';
import { UniversalCanvasProvider, ContentCacheRegistry } from '@acc/core-isomorphic';
import { bootstrapNode } from '@acc/core';
import type { ModifierContext, ClipRenderContext } from '../packages/ir/src/plugins/ModifierPluginRegistry';
import type { ResolvedTimeline, ResolvedSequence, ResolvedTrack } from '@acc/ir';

describe('Depth3DPlugin & Sidecar Inference Resolution Suite', () => {
  let plugin: Depth3DPlugin;
  let scratchCanvas: any;

  beforeAll(async () => {
    await bootstrapNode();
  });

  beforeEach(() => {
    plugin = new Depth3DPlugin();
    scratchCanvas = UniversalCanvasProvider.createCanvas(320, 240);
  });

  it('resolves imagePath from context.assets via sequence assetId when params.imagePath is omitted', async () => {
    // 1x1 transparent PNG data URI
    const dummyAssetUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const context: ModifierContext = {
      targetType: 'sequence',
      targetEntity: {
        id: 'seq-cyber-drone',
        assetId: 'asset-cyber-drone',
        trackId: 'track-v1',
        startFrame: 0,
        durationFrames: 60,
      } as unknown as ResolvedSequence,
      timeline: new Map(),
      assets: {
        'asset-cyber-drone': {
          src: dummyAssetUri,
          type: 'image',
        },
      },
      fps: 30,
      canvas: { width: 320, height: 240 },
    };

    // Execute with fast heuristic strategies so unit test runs in <20ms
    await plugin.execute(context, {
      mode: 'frame_breaker',
      popOutIntensity: 1.5,
      depthStrategy: 'heuristic',
      segmentationStrategy: 'grabcut-fallback',
    });

    expect(context.state?.depth3d).toBeDefined();
    expect((context.state?.depth3d as any).active).toBe(true);
    expect((context.state?.depth3d as any).mode).toBe('frame_breaker');
  });

  it('renders clip space seamlessly using sequence.assetId when params.imagePath is undefined', () => {
    const rawCanvas = scratchCanvas.getRawCanvas ? scratchCanvas.getRawCanvas() : scratchCanvas;
    const ctx = rawCanvas.getContext('2d');
    const dummyAsset = UniversalCanvasProvider.createCanvas(100, 100);
    const rawAsset = dummyAsset.getRawCanvas ? dummyAsset.getRawCanvas() : dummyAsset;

    const renderCtx: ClipRenderContext = {
      ctx,
      width: 320,
      height: 240,
      localFrame: 15,
      sequence: {
        id: 'seq-cyber-drone',
        assetId: 'asset-cyber-drone',
        trackId: 'track-v1',
        startFrame: 0,
        durationFrames: 60,
        type: 'image',
      } as ResolvedSequence,
      baseAsset: rawAsset,
    };

    // Calling renderClipSpace without params.imagePath should NOT throw and correctly complete
    expect(() => {
      plugin.renderClipSpace(renderCtx, {
        mode: 'frame_breaker',
        popOutIntensity: 1.25,
      });
    }).not.toThrow();
  });

  it('StudioSidecarCoordinator automatically injects assets and binds effectiveImagePath during preflight', async () => {
    const coordinator = new StudioSidecarCoordinator();
    coordinator.reset();

    const track: ResolvedTrack = {
      id: 't-1',
      name: 'V1',
      type: 'video',
      sequences: [],
    };

    const seq: ResolvedSequence = {
      id: 'seq-1',
      trackId: 't-1',
      startFrame: 0,
      durationFrames: 60,
      assetId: 'asset-drone',
      modifiers: [
        {
          type: 'vfx/depth3d',
          params: {
            mode: 'parallax_25d',
          },
        },
      ],
    };

    track.sequences = [seq];

    const timeline: ResolvedTimeline = {
      meta: {
        canvasSize: { w: 1280, h: 720 },
        globalFps: 30,
        backgroundColor: '#000000',
      },
      tracks: new Map([['t-1', track]]),
      sequences: new Map([['seq-1', seq]]),
      assets: {
        'asset-drone': {
          src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          type: 'image',
        },
      },
      totalFrames: 120,
    };

    let warmedCount = 0;
    const unsub = coordinator.onModifierWarmed((ev) => {
      if (ev.targetId === 'seq-1' && ev.modifierType === 'vfx/depth3d') {
        warmedCount++;
      }
    });

    await coordinator.preflightTimeline(timeline, { prioritizedFrame: 0 });

    expect(warmedCount).toBe(1);
    unsub();
    coordinator.terminate();
  });

  it('IRCanvasCompositor preserves each sequence modifier popOutIntensity without global overwrite', () => {
    const rawCanvas = scratchCanvas.getRawCanvas ? scratchCanvas.getRawCanvas() : scratchCanvas;
    const ctx = rawCanvas.getContext('2d');

    const dispatchedIntensities: number[] = [];
    const testRegistry = {
      get: (type: string) => {
        if (type === 'vfx/depth3d') {
          return {
            type: 'vfx/depth3d',
            targetScope: 'sequence',
            targetPhase: 2,
            renderClipSpace: (_c: any, params: any) => {
              dispatchedIntensities.push(params.popOutIntensity);
            },
          };
        }
        return undefined;
      },
    } as any;

    const seqA: ResolvedSequence = {
      id: 'seq-a',
      trackId: 't-1',
      startFrame: 0,
      endFrame: 30,
      durationFrames: 30,
      modifiers: [
        {
          type: 'vfx/depth3d',
          params: { popOutIntensity: 2.25 },
        },
      ],
    };

    const seqB: ResolvedSequence = {
      id: 'seq-b',
      trackId: 't-1',
      startFrame: 0,
      endFrame: 30,
      durationFrames: 30,
      modifiers: [
        {
          type: 'vfx/depth3d',
          params: { popOutIntensity: 0.75 },
        },
      ],
    };

    const timeline: ResolvedTimeline = {
      meta: {
        canvasSize: { w: 320, h: 240 },
        globalFps: 30,
        backgroundColor: '#000000',
      },
      tracks: new Map([
        [
          't-1',
          {
            id: 't-1',
            name: 'V1',
            type: 'video',
            sequences: [seqA, seqB],
          },
        ],
      ]),
      sequences: new Map([
        ['seq-a', seqA],
        ['seq-b', seqB],
      ]),
      totalFrames: 60,
    };

    const { IRCanvasCompositor } = require('@acc/ir');
    // Call renderFrame without options.popOutIntensity
    IRCanvasCompositor.renderFrame(ctx, timeline, 5, {
      pluginRegistry: testRegistry,
    });

    expect(dispatchedIntensities).toEqual([2.25, 0.75]);
  });
});
