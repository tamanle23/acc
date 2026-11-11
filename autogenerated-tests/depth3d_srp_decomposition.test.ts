import { describe, it, expect, beforeAll } from 'bun:test';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { bootstrapNode } from '../packages/core/src/bootstrap';
import {
  DepthScenePreprocessor,
  DepthCanvasCompositor,
  MediaSinkStreamer,
  renderDepth3DScene,
} from '../packages/effect-engines/src/depth3d';
import type { ResolvedStoryConfig, ResolvedSceneConfig } from '../packages/effect-engines/src/types';

describe('Phase 2: Depth3D SRP Decomposition & Compositor Parity', () => {
  beforeAll(async () => {
    await bootstrapNode();
  });

  const dummyImage =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const mockConfig: ResolvedStoryConfig = {
    settings: {
      width: 320,
      height: 240,
      fps: 30,
      platform: 'youtube' as any,
      captions: { enabled: false } as any,
    },
  } as any;

  const mockScene: ResolvedSceneConfig = {
    id: 'test-scene',
    resolvedImage: dummyImage,
    depth3d: {
      enabled: true,
      mode: 'parallax_25d',
      autoDepth: false,
    },
  } as any;

  it('DepthScenePreprocessor: prepares depth layers and cleans up via RAII dispose()', async () => {
    const preprocessed = await DepthScenePreprocessor.prepare(
      mockScene,
      mockScene.depth3d!,
      320,
      240
    );

    expect(preprocessed.img).toBeDefined();
    expect(preprocessed.dCanvas).toBeDefined();
    expect(preprocessed.sCanvas).toBeDefined();
    expect(preprocessed.particles.length).toBe(28);

    // RAII Cleanup must complete without error
    expect(() => preprocessed.dispose()).not.toThrow();
  });

  it('DepthCanvasCompositor: composites frame onto canvas without leaking context state', async () => {
    const preprocessed = await DepthScenePreprocessor.prepare(
      mockScene,
      mockScene.depth3d!,
      320,
      240
    );

    const compositor = new DepthCanvasCompositor();
    const canvas = UniversalCanvasProvider.createCanvas(320, 240);
    const ctx = canvas.getContext('2d');

    expect(() => {
      compositor.renderFrame(ctx, {
        frame: 10,
        totalFrames: 30,
        fps: 30,
        width: 320,
        height: 240,
        scene: mockScene,
        config: mockConfig,
        depthConfig: mockScene.depth3d!,
        preprocessed,
      });
    }).not.toThrow();

    preprocessed.dispose();
  });

  it('renderDepth3DScene Orchestrator: delegates seamlessly with mock sink', async () => {
    const consumedFrames: number[] = [];
    const mockSink: any = {
      initialize: async () => {},
      consumeFrame: async (frame: number) => {
        consumedFrames.push(frame);
      },
      finalize: async () => {},
    };

    const res = await renderDepth3DScene({
      scene: mockScene,
      duration: 0.1, // 3 frames at 30 fps
      assPath: null,
      config: mockConfig,
      outputPath: 'out.mp4',
      sink: mockSink,
    });

    expect(res.duration).toBe(0.1);
    expect(consumedFrames.length).toBe(3);
  });
});
