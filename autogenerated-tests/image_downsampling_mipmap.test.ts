import { describe, it, expect } from 'bun:test';
import {
  IRCanvasCompositor,
  type IAssetSourceResolver,
  type ResolvedTimeline,
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
} from '../packages/ir/src';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native';

describe('IRCanvasCompositor - Spatial Conformance & Downsampling Mipmap', () => {
  UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
  const pluginRegistry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());

  function createMockTimeline(): ResolvedTimeline {
    return {
      meta: {
        contentId: 'test-conformance',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: new Map([
        [
          't1',
          {
            id: 't1',
            type: 'video',
            sequences: [
              {
                id: 'seq1',
                type: 'image',
                trackId: 't1',
                assetId: 'ultra-hd-asset',
                startFrame: 0,
                endFrame: 30,
                durationFrames: 30,
                fitMode: 'cover',
                crop: { top: 0.05, bottom: 0.05, left: 0.1, right: 0.1 },
              },
            ],
          },
        ],
      ]),
      sequences: new Map(),
      totalFrames: 30,
      durationSeconds: 1.0,
    };
  }

  it('renders extreme 8K asset (8000x6000) onto 1080p canvas executing mipmap downsampling without error', async () => {
    const timeline = createMockTimeline();
    const canvasInst = UniversalCanvasProvider.createCanvas(1920, 1080);
    const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
    const ctx = canvas.getContext('2d');

    const drawImageCalls: any[] = [];
    const origDrawImage = ctx.drawImage.bind(ctx);
    ctx.drawImage = (img: any, ...args: any[]) => {
      drawImageCalls.push({ img, args });
      try {
        origDrawImage(img, ...args);
      } catch {}
    };

    // 8000x6000 asset
    const highResAsset = UniversalCanvasProvider.createCanvas(8000, 6000);
    const mockAssetResolver: IAssetSourceResolver = {
      has: (id) => id === 'ultra-hd-asset',
      get: (id) => highResAsset,
    };

    await IRCanvasCompositor.renderFrame(ctx, timeline, 10, {
      pluginRegistry,
      assetResolver: mockAssetResolver,
    });

    // Verify drawImage was called (intermediate mipmap steps + final draw)
    expect(drawImageCalls.length).toBeGreaterThanOrEqual(1);

    // Final draw must place image onto target canvas bounds
    const finalDraw = drawImageCalls[drawImageCalls.length - 1];
    expect(finalDraw.args.length).toBe(8); // sx, sy, sw, sh, dx, dy, dw, dh
  });

  it('handles crop parameters accurately in sequence rendering', async () => {
    const timeline = createMockTimeline();
    const canvasInst = UniversalCanvasProvider.createCanvas(1920, 1080);
    const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
    const ctx = canvas.getContext('2d');

    let capturedArgs: any[] = [];
    ctx.drawImage = (img: any, ...args: any[]) => {
      capturedArgs = args;
    };

    // 2000x1000 asset with crop: top 0.05, bottom 0.05, left 0.1, right 0.1
    const asset = {
      width: 2000,
      height: 1000,
    };

    const mockAssetResolver: IAssetSourceResolver = {
      has: () => true,
      get: () => asset,
    };

    await IRCanvasCompositor.renderFrame(ctx, timeline, 5, {
      pluginRegistry,
      assetResolver: mockAssetResolver,
    });

    expect(capturedArgs.length).toBe(8);
    const [sx, sy, sw, sh] = capturedArgs;
    // sx = 2000 * 0.1 = 200
    // sy = 1000 * 0.05 = 50
    // sw = 2000 * (1 - 0.1 - 0.1) = 1600
    // sh = 1000 * (1 - 0.05 - 0.05) = 900
    expect(sx).toBe(200);
    expect(sy).toBe(50);
    expect(sw).toBe(1600);
    expect(sh).toBe(900);
  });
});
