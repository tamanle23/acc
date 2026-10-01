import { describe, test, expect } from 'bun:test';
import { AssetContext, FlyweightModelRegistry } from '../packages/core/src/AssetContext';
import { XFadeTransitionCommand, Depth3DPopOutCommand, CompositeVFXCommand } from '../packages/core/src/VFXCommand';
import { BoundedQueue } from '../packages/core/src/BoundedQueue';
import { PipelineRunner, PipelineContext, IPipelineMiddleware } from '../packages/core/src/PipelineRunner';
import { FFmpegFilterGraph } from '../packages/core/src/FFmpegFilterGraph';

describe('Design Patterns & Pipeline Architecture Implementation', () => {

  describe('Shared Context & Flyweight Pattern', () => {
    test('AssetContext registers variants, metadata, and handles fallbacks', () => {
      const ctx = new AssetContext();
      ctx.register('scene1', 'original', '/path/to/scene1.jpg', { width: 1920, height: 1080 });
      ctx.register('scene1', 'upscaled', '/path/to/scene1_upscaled.png', { width: 3840, height: 2160 });

      expect(ctx.getPreferred('scene1', ['upscaled', 'original'])).toBe('/path/to/scene1_upscaled.png');
      expect(ctx.getPreferred('scene1', ['non_existent', 'original'])).toBe('/path/to/scene1.jpg');
      expect(ctx.getMetadata('scene1', 'upscaled')).toEqual({ width: 3840, height: 2160 });
      expect(ctx.getVariants('scene1')?.size).toBe(2);
    });

    test('FlyweightModelRegistry manages AI model handles and LRU eviction', async () => {
      const registry = FlyweightModelRegistry.getInstance();
      let loaderCalls = 0;

      const mockLoader = async () => {
        loaderCalls++;
        return { name: 'test-model', dispose: () => {} };
      };

      const model1 = await registry.acquireModel('vllm-llama3', mockLoader);
      const model2 = await registry.acquireModel('vllm-llama3', mockLoader);

      expect(model1).toBe(model2);
      expect(loaderCalls).toBe(1);
      expect(registry.hasModel('vllm-llama3')).toBe(true);

      await registry.releaseInactiveModels(0); // force eviction
      expect(registry.hasModel('vllm-llama3')).toBe(false);
    });
  });

  describe('Command Pattern (VFX & Stitching)', () => {
    test('XFadeTransitionCommand validation and graph compilation', async () => {
      const ctx = new AssetContext();
      ctx.register('s1', 'original', '/img1.jpg');
      ctx.register('s2', 'original', '/img2.jpg');

      const cmd = new XFadeTransitionCommand('xfade_1', 's1', 's2', 'fade', 1.5, 3.0);
      const validation = cmd.validate(ctx);
      expect(validation.valid).toBe(true);

      const graph = new FFmpegFilterGraph();
      await cmd.compileToFilterGraph(graph, ctx);

      const filterStr = graph.compile();
      expect(filterStr).toContain('xfade=transition=fade:duration=1.5:offset=3');
    });

    test('Depth3DPopOutCommand validation fails if cutout is missing', async () => {
      const ctx = new AssetContext();
      ctx.register('s1', 'original', '/img1.jpg');

      const cmd = new Depth3DPopOutCommand('depth_1', 's1');
      const validation = cmd.validate(ctx);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('cutout'))).toBe(true);
    });

    test('CompositeVFXCommand aggregates cost and executes child commands', async () => {
      const ctx = new AssetContext();
      ctx.register('s1', 'original', '/img1.jpg');
      ctx.register('s2', 'original', '/img2.jpg');

      const cmd1 = new XFadeTransitionCommand('xf1', 's1', 's2', 'fade', 1.0, 2.0);
      const macro = new CompositeVFXCommand('macro1', [cmd1]);

      expect(macro.validate(ctx).valid).toBe(true);
      expect(macro.estimateCost().cpuScore).toBe(2);
    });
  });

  describe('Producer-Consumer Pattern (Bounded Queue)', () => {
    test('BoundedQueue handles async enqueue, dequeue, and backpressure', async () => {
      const queue = new BoundedQueue<number>(2);

      await queue.enqueue(10);
      await queue.enqueue(20);

      expect(queue.size()).toBe(2);

      let producerResolved = false;
      const enqueuePromise = queue.enqueue(30).then(() => { producerResolved = true; });

      // Queue is at capacity, enqueue is blocked
      expect(producerResolved).toBe(false);

      const item1 = await queue.dequeue();
      expect(item1).toBe(10);

      await enqueuePromise;
      expect(producerResolved).toBe(true);

      const item2 = await queue.dequeue();
      expect(item2).toBe(20);

      const item3 = await queue.dequeue();
      expect(item3).toBe(30);

      queue.end();
      const endItem = await queue.dequeue();
      expect(endItem).toBeUndefined();
    });
  });

  describe('Pipeline Pattern (Middleware Architecture)', () => {
    test('PipelineRunner chains middlewares and handles defensive fault isolation', async () => {
      const runner = new PipelineRunner();

      const stage1: IPipelineMiddleware = {
        name: 'Stage1_AssetLoader',
        execute: async (ctx, next) => {
          ctx.assets.register('scene1', 'original', '/scene1.jpg');
          await next();
        }
      };

      const stage2Failing: IPipelineMiddleware = {
        name: 'Stage2_FailingUpscaler',
        execute: async (ctx, next) => {
          throw new Error('GPU Out of Memory');
        }
      };

      const stage3Fallback: IPipelineMiddleware = {
        name: 'Stage3_VFXComposer',
        execute: async (ctx, next) => {
          const img = ctx.assets.getPreferred('scene1', ['upscaled', 'original']);
          ctx.metadata['resolvedImage'] = img;
          await next();
        }
      };

      runner.use(stage1).use(stage2Failing).use(stage3Fallback);

      const pipeCtx: PipelineContext = {
        storyId: 'story_test_1',
        baseDir: '/tmp',
        assets: new AssetContext(),
        vfxQueue: [],
        metadata: {},
        errors: []
      };

      const result = await runner.run(pipeCtx);

      expect(result.errors.length).toBe(1);
      expect(result.errors[0].stage).toBe('Stage2_FailingUpscaler');
      expect(result.metadata['resolvedImage']).toBe('/scene1.jpg');
    });
  });

});
