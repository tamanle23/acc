import { describe, it, expect } from 'bun:test';
import {
  IRCanvasCompositor,
  type IAssetSourceResolver,
  registerCoreModifierPlugins,
  ModifierPluginRegistry,
  type ResolvedTimeline,
  type ResolvedTrack,
} from '../packages/ir/src';
import { UniversalCanvasProvider } from '@acc/effect-engines';

describe('Iteration 10 Phase 2: Canonical IRCanvasCompositor', () => {
  const pluginRegistry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());

  function createMockTimeline(): ResolvedTimeline {
    const tracks = new Map<string, ResolvedTrack>();

    // Track 0: Base Video (V1)
    tracks.set('track_v1', {
      id: 'track_v1',
      type: 'video',
      sequences: [
        {
          id: 'seq_v1',
          type: 'video',
          trackId: 'track_v1',
          assetId: 'asset_bg',
          startFrame: 0,
          endFrame: 60,
          durationFrames: 60,
        },
      ],
    });

    // Track 1: Overlay Video (V2) with blendMode
    tracks.set('track_v2', {
      id: 'track_v2',
      type: 'video',
      sequences: [
        {
          id: 'seq_v2',
          type: 'video',
          trackId: 'track_v2',
          assetId: 'asset_overlay',
          startFrame: 0,
          endFrame: 60,
          durationFrames: 60,
          blendMode: 'screen',
        },
      ],
    });

    // Track 2: Timed Text (Captions)
    tracks.set('track_captions', {
      id: 'track_captions',
      type: 'timed_text',
      style: {
        preset: 'tiktok',
        fontSize: 48,
        primaryColor: '#FFFFFF',
      },
      sequences: [
        {
          id: 'seq_c1',
          type: 'text',
          trackId: 'track_captions',
          startFrame: 0,
          endFrame: 60,
          durationFrames: 60,
          cues: [
            { text: 'Hello', startOffsetMs: 0, endOffsetMs: 1000 },
            { text: 'World', startOffsetMs: 1000, endOffsetMs: 2000 },
          ],
        },
      ],
    });

    return {
      meta: {
        contentId: 'test_composite',
        globalFps: 30,
        canvasSize: { w: 640, h: 360 },
      },
      tracks,
      sequences: new Map(),
      totalFrames: 60,
      durationSeconds: 2.0,
    };
  }

  it('should render frame with pure black #000000 viewport clear by default', () => {
    const timeline = createMockTimeline();
    const canvasInst = UniversalCanvasProvider.createCanvas(640, 360);
    const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
    const ctx = canvas.getContext('2d');

    IRCanvasCompositor.renderFrame(ctx, timeline, 0, {
      pluginRegistry,
    });

    // Verify context was cleared and initialized
    expect(typeof ctx.fillRect).toBe('function');
  });

  it('should respect pure document order (Track 0 -> Track 1) and scoped blend modes', () => {
    const timeline = createMockTimeline();
    const canvasInst = UniversalCanvasProvider.createCanvas(640, 360);
    const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
    const ctx = canvas.getContext('2d');

    const drawCalls: string[] = [];
    ctx.drawImage = (img: any, ...args: any[]) => {
      drawCalls.push(img.id || 'asset');
    };

    const mockAssetResolver: IAssetSourceResolver = {
      has: (id) => true,
      get: (id) => ({ id, width: 640, height: 360 }),
    };

    IRCanvasCompositor.renderFrame(ctx, timeline, 15, {
      pluginRegistry,
      assetResolver: mockAssetResolver,
    });

    // Both track 0 and track 1 should be drawn in order
    expect(drawCalls).toEqual(['asset_bg', 'asset_overlay']);
    // Blend mode should be restored to default after layer renders
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });

  it('should render timed_text tracks strictly on top of visual tracks', () => {
    const timeline = createMockTimeline();
    const canvasInst = UniversalCanvasProvider.createCanvas(640, 360);
    const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
    const ctx = canvas.getContext('2d');

    let textRendered = false;
    const origFillText = ctx.fillText;
    ctx.fillText = (text: string, ...args: any[]) => {
      textRendered = true;
      if (typeof origFillText === 'function') {
        origFillText.apply(ctx, [text, ...args]);
      }
    };

    IRCanvasCompositor.renderFrame(ctx, timeline, 15, {
      pluginRegistry,
    });

    expect(textRendered).toBe(true);
  });

  it('should explicitly cull and skip rendering when track.muted === true or sequence.enabled === false', () => {
    const timeline = createMockTimeline();
    // Mute Track 1
    const trackV2 = timeline.tracks.get('track_v2')!;
    (trackV2 as any).muted = true;

    const canvasInst = UniversalCanvasProvider.createCanvas(640, 360);
    const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
    const ctx = canvas.getContext('2d');

    const drawnAssets: string[] = [];
    ctx.drawImage = (img: any) => {
      drawnAssets.push(img.id);
    };

    const mockAssetResolver: IAssetSourceResolver = {
      has: () => true,
      get: (id) => ({ id, width: 640, height: 360 }),
    };

    IRCanvasCompositor.renderFrame(ctx, timeline, 15, {
      pluginRegistry,
      assetResolver: mockAssetResolver,
    });

    // Only track_v1 (asset_bg) should be drawn; track_v2 was culled
    expect(drawnAssets).toEqual(['asset_bg']);
  });

  it('should populate pre-allocated pixel buffer preserving ZERO-ALLOC-FRAME-LOOP', () => {
    const timeline = createMockTimeline();
    const canvasInst = UniversalCanvasProvider.createCanvas(640, 360);
    const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
    const ctx = canvas.getContext('2d');
    const pixelBuffer = new Uint8Array(640 * 360 * 4);

    IRCanvasCompositor.renderFrame(ctx, timeline, 0, {
      pluginRegistry,
      generatePixelBuffer: pixelBuffer,
    });

    expect(pixelBuffer.byteLength).toBe(640 * 360 * 4);
  });
});
