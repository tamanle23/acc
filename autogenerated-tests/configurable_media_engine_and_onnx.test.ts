import { describe, it, expect, beforeEach } from 'bun:test';
import {
  MediaEngineRegistry,
  ContentCacheRegistry,
  MemoryCacheStrategy,
  OnnxModelManager,
  VisionEngineRegistry,
  DepthStrategyId,
  SegmentationStrategyId,
} from '@acc/core-isomorphic';
import {
  BunFFIEngineStrategy,
  FluentFFmpegEngineStrategy,
  MediabunnyServerStrategy,
  NativeFileCacheStrategy,
  FFmpegManager,
  bootstrapNode,
} from '@acc/core';
import {
  UniversalOnnxRuntimeProvider,
} from '@acc/effect-engines';

describe('Iteration 32: Configurable Target Runtime (MediaEngine, OnnxModelManager & Universal ONNX Provider)', () => {
  beforeEach(async () => {
    await FFmpegManager.prepare();
  });

  it('Pillar 1: Configurable MediaEngineRegistry dynamically registers and selects core strategies', () => {
    if (!MediaEngineRegistry.has('bun-ffi')) {
      MediaEngineRegistry.register(new BunFFIEngineStrategy());
    }
    if (!MediaEngineRegistry.has('fluent-ffmpeg')) {
      MediaEngineRegistry.register(new FluentFFmpegEngineStrategy());
    }
    if (!MediaEngineRegistry.has('mediabunny')) {
      MediaEngineRegistry.register(new MediabunnyServerStrategy());
    }

    expect(MediaEngineRegistry.has('bun-ffi')).toBe(true);
    expect(MediaEngineRegistry.has('fluent-ffmpeg')).toBe(true);
    expect(MediaEngineRegistry.has('mediabunny')).toBe(true);

    const ffiStrat = MediaEngineRegistry.get('bun-ffi');
    const fluentStrat = MediaEngineRegistry.get('fluent-ffmpeg');
    const mbStrat = MediaEngineRegistry.get('mediabunny');

    expect(ffiStrat.id).toBe('bun-ffi');
    expect(fluentStrat.id).toBe('fluent-ffmpeg');
    expect(mbStrat.id).toBe('mediabunny-server');

    // Default strategy auto-resolves correctly
    const defaultStrat = MediaEngineRegistry.get();
    expect(defaultStrat).toBeDefined();
    expect(typeof defaultStrat.createVideoSink).toBe('function');
  });

  it('Pillar 2: OnnxModelManager stores and retrieves model assets via ContentCacheRegistry', async () => {
    const memoryStrategy = new MemoryCacheStrategy();
    ContentCacheRegistry.register(memoryStrategy, true);

    const modelManager = OnnxModelManager.getInstance();
    expect(modelManager.hasModelMetadata('briaai/RMBG-1.4')).toBe(true);
    expect(modelManager.hasModelMetadata('depth-anything/Depth-Anything-V2-Small-hf')).toBe(true);

    // Mock binary model weights buffer
    const mockModelBuffer = new Uint8Array([0x4f, 0x4e, 0x4e, 0x58, 0x01, 0x02, 0x03]);
    await modelManager.storeModelBuffer('test-model-v1', mockModelBuffer);

    const retrieved = await modelManager.getCachedModelBuffer('test-model-v1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.length).toBe(mockModelBuffer.length);
    expect(retrieved?.[0]).toBe(0x4f);
    expect(retrieved?.[3]).toBe(0x58);
  });

  it('Pillar 3: UniversalOnnxRuntimeProvider resolves active backend without throwing native binary errors', async () => {
    const status = await UniversalOnnxRuntimeProvider.getStatus();
    expect(status).toBeDefined();
    expect(['transformers', 'heuristic']).toContain(status.backend);
    expect(status.available).toBe(true);

    const tf = await UniversalOnnxRuntimeProvider.getTransformers();
    expect(tf).toBeDefined();
    expect(typeof tf.pipeline).toBe('function');
  });

  it('Pillar 4: VisionEngineRegistry operates seamlessly with registered isomorphic strategies', async () => {
    await bootstrapNode();
    const segStrat = VisionEngineRegistry.getSegmentationStrategy();
    expect(segStrat.id).toBe(SegmentationStrategyId.Rmbg14);
    expect(segStrat.name).toBe('rmbg-1.4');

    const depthStrat = VisionEngineRegistry.getDepthStrategy();
    expect(depthStrat.id).toBe(DepthStrategyId.DepthAnythingV2Small);
    expect(depthStrat.name).toBe('depth-anything-v2-small');
  });
});
