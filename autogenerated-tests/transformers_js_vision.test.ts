import { describe, it, expect, beforeAll } from 'bun:test';
import { createCanvas } from '@napi-rs/canvas';
import { bootstrapNode } from '../packages/core/src/bootstrap';
import {
  VisionEngineRegistry,
  DepthStrategyId,
  SegmentationStrategyId,
  type ISubjectSegmentationStrategy,
  type IDepthEstimationStrategy,
  type VisionImageInput,
  type SubjectSegmentationResult,
  type DepthEstimationResult,
} from '@acc/core-isomorphic';
import {
  SlimSamStrategy,
  SamVitBaseStrategy,
  Sam2TinyStrategy,
  RmbgStrategy,
  BiRefNetStrategy,
  GrabCutFallbackStrategy,
  DepthAnythingV2SmallStrategy,
  DepthAnythingV2BaseStrategy,
  GlpnMetricStrategy,
  DptLargeStrategy,
  HeuristicDepthStrategy,
  createCutoutRgba,
} from '../packages/effect-engines/src/vision';

describe('Vision Strategy Pattern Suite (@huggingface/transformers + Zero-Crash Fallbacks)', () => {
  let testImageBuffer: Buffer;

  beforeAll(async () => {
    await bootstrapNode();
    // Register all strategies into VisionEngineRegistry
    VisionEngineRegistry.registerSegmentationStrategy(new GrabCutFallbackStrategy());
    VisionEngineRegistry.registerSegmentationStrategy(new RmbgStrategy(), true);
    VisionEngineRegistry.registerSegmentationStrategy(new BiRefNetStrategy());
    VisionEngineRegistry.registerSegmentationStrategy(new SlimSamStrategy());
    VisionEngineRegistry.registerSegmentationStrategy(new Sam2TinyStrategy());
    VisionEngineRegistry.registerSegmentationStrategy(new SamVitBaseStrategy());

    VisionEngineRegistry.registerDepthStrategy(new HeuristicDepthStrategy());
    VisionEngineRegistry.registerDepthStrategy(new DepthAnythingV2SmallStrategy(), true);
    VisionEngineRegistry.registerDepthStrategy(new DepthAnythingV2BaseStrategy());
    VisionEngineRegistry.registerDepthStrategy(new GlpnMetricStrategy());
    VisionEngineRegistry.registerDepthStrategy(new DptLargeStrategy());

    // Generate a test RGBA canvas image with a distinct subject
    const canvas = createCanvas(320, 240);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#112233';
    ctx.fillRect(0, 0, 320, 240);
    // Draw foreground circular subject
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(160, 120, 50, 0, Math.PI * 2);
    ctx.fill();

    testImageBuffer = canvas.toBuffer('image/png');
  });

  describe('VisionEngineRegistry & Segmentation Strategies', () => {
    it('should initialize with default RMBG-1.4 strategy', () => {
      const segStrat = VisionEngineRegistry.getSegmentationStrategy();
      expect(segStrat.name).toBe('rmbg-1.4');
    });

    it('should switch strategies dynamically via VisionEngineRegistry', () => {
      VisionEngineRegistry.setDefaultSegmentationStrategy(SegmentationStrategyId.GrabCutFallback);
      expect(VisionEngineRegistry.getSegmentationStrategy().name).toBe('grabcut-fallback');

      VisionEngineRegistry.setDefaultSegmentationStrategy(SegmentationStrategyId.SamVitBase);
      expect(VisionEngineRegistry.getSegmentationStrategy().name).toBe('sam-vit-base');

      VisionEngineRegistry.setDefaultSegmentationStrategy(SegmentationStrategyId.Sam2Tiny);
      expect(VisionEngineRegistry.getSegmentationStrategy().name).toBe('sam2-tiny');

      VisionEngineRegistry.setDefaultSegmentationStrategy(SegmentationStrategyId.Rmbg14);
      expect(VisionEngineRegistry.getSegmentationStrategy().name).toBe('rmbg-1.4');

      VisionEngineRegistry.setDefaultSegmentationStrategy(SegmentationStrategyId.BiRefNet);
      expect(VisionEngineRegistry.getSegmentationStrategy().name).toBe('birefnet-general');

      VisionEngineRegistry.setDefaultSegmentationStrategy(SegmentationStrategyId.SlimSam);
      expect(VisionEngineRegistry.getSegmentationStrategy().name).toBe('slimsam');
    });

    it('should execute GrabCutFallbackStrategy and return valid mask buffer', async () => {
      const strat = VisionEngineRegistry.getSegmentationStrategy(SegmentationStrategyId.GrabCutFallback);
      const result = await (strat as any).segment(testImageBuffer);
      expect(result).toBeDefined();
      expect(result.width).toBe(320);
      expect(result.height).toBe(240);
      expect(result.maskRgbaBuffer).toBeDefined();
      expect(Buffer.isBuffer(result.maskRgbaBuffer)).toBe(true);
      expect(result.maskRgbaBuffer.length).toBeGreaterThan(100);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should allow injecting custom segmentation strategy', async () => {
      class MockCustomStrategy implements ISubjectSegmentationStrategy {
        public readonly id = 'custom-seg' as any;
        public readonly name = 'mock-custom-seg';
        public readonly isSupported = true;
        async segment(input: VisionImageInput): Promise<SubjectSegmentationResult> {
          return {
            maskAlphaData: new Uint8Array(input.width * input.height),
            width: input.width,
            height: input.height,
            confidence: 0.99,
            modelUsed: 'mock-custom-seg',
            boundingBox: { x: 0, y: 0, width: input.width, height: input.height }
          };
        }
      }

      VisionEngineRegistry.registerSegmentationStrategy(new MockCustomStrategy(), true);
      const strat = VisionEngineRegistry.getSegmentationStrategy();
      expect(strat.name).toBe('mock-custom-seg');

      const result = await strat.segment({ data: testImageBuffer, width: 100, height: 100 });
      expect(result.confidence).toBe(0.99);
      expect(result.width).toBe(100);

      // Restore default strategy
      VisionEngineRegistry.setDefaultSegmentationStrategy(SegmentationStrategyId.Rmbg14);
    });
  });

  describe('VisionEngineRegistry & Depth Strategies', () => {
    it('should initialize with default Depth Anything v2 Small strategy', () => {
      VisionEngineRegistry.setDefaultDepthStrategy(DepthStrategyId.DepthAnythingV2Small);
      const depthStrat = VisionEngineRegistry.getDepthStrategy();
      expect(depthStrat.name).toBe('depth-anything-v2-small');
    });

    it('should switch depth strategies dynamically via VisionEngineRegistry', () => {
      VisionEngineRegistry.setDefaultDepthStrategy(DepthStrategyId.Heuristic);
      expect(VisionEngineRegistry.getDepthStrategy().name).toBe('heuristic-depth');

      VisionEngineRegistry.setDefaultDepthStrategy(DepthStrategyId.DepthAnythingV2Base);
      expect(VisionEngineRegistry.getDepthStrategy().name).toBe('depth-anything-v2-base');

      VisionEngineRegistry.setDefaultDepthStrategy(DepthStrategyId.GlpnMetric);
      expect(VisionEngineRegistry.getDepthStrategy().name).toBe('glpn-metric');

      VisionEngineRegistry.setDefaultDepthStrategy(DepthStrategyId.DptLarge);
      expect(VisionEngineRegistry.getDepthStrategy().name).toBe('dpt-large');

      VisionEngineRegistry.setDefaultDepthStrategy(DepthStrategyId.DepthAnythingV2Small);
      expect(VisionEngineRegistry.getDepthStrategy().name).toBe('depth-anything-v2-small');
    });

    it('should execute HeuristicDepthStrategy and return 16-bit depth buffer', async () => {
      const strat = VisionEngineRegistry.getDepthStrategy(DepthStrategyId.Heuristic);
      const result = await (strat as any).estimateDepth(testImageBuffer);
      expect(result).toBeDefined();
      expect(result.width).toBe(320);
      expect(result.height).toBe(240);
      expect(result.depth16Buffer).toBeDefined();
      expect(Buffer.isBuffer(result.depth16Buffer)).toBe(true);
      expect(result.depth16Buffer.length).toBeGreaterThan(100);
      expect(result.minDepth).toBe(0.5);
      expect(result.maxDepth).toBe(8.5);
    });

    it('should allow injecting custom depth strategy', async () => {
      class MockDepthStrategy implements IDepthEstimationStrategy {
        public readonly id = 'mock-depth' as any;
        public readonly name = 'mock-custom-depth';
        public readonly isSupported = true;
        async estimateDepth(input: VisionImageInput): Promise<DepthEstimationResult> {
          return {
            depth16Data: new Uint16Array(input.width * input.height),
            width: input.width,
            height: input.height,
            minDepth: 0.1,
            maxDepth: 0.9,
            modelUsed: 'mock-custom-depth',
          };
        }
      }

      VisionEngineRegistry.registerDepthStrategy(new MockDepthStrategy(), true);
      const strat = VisionEngineRegistry.getDepthStrategy();
      expect(strat.name).toBe('mock-custom-depth');

      const result = await strat.estimateDepth({ data: testImageBuffer, width: 200, height: 150 });
      expect(result.minDepth).toBe(0.1);
      expect(result.maxDepth).toBe(0.9);

      // Restore
      VisionEngineRegistry.setDefaultDepthStrategy(DepthStrategyId.DepthAnythingV2Small);
    });
  });

  describe('Vision Utility Functions', () => {
    it('should create cutout RGBA cleanly using alpha mask', async () => {
      const srcCanvas = createCanvas(100, 100);
      const sCtx = srcCanvas.getContext('2d');
      sCtx.fillStyle = '#ff0000';
      sCtx.fillRect(0, 0, 100, 100);
      const srcBuf = srcCanvas.toBuffer('image/png');

      const maskCanvas = createCanvas(100, 100);
      const mCtx = maskCanvas.getContext('2d');
      mCtx.fillStyle = '#000000';
      mCtx.fillRect(0, 0, 100, 100);
      mCtx.fillStyle = '#ffffff';
      mCtx.fillRect(25, 25, 50, 50);
      const maskBuf = maskCanvas.toBuffer('image/png');

      const cutout = await createCutoutRgba(srcBuf, maskBuf);
      expect(cutout).toBeDefined();
      expect(Buffer.isBuffer(cutout.rgbaBuffer)).toBe(true);
      expect(cutout.rgbaBuffer.length).toBeGreaterThan(100);
      expect(cutout.bbox).toBeDefined();
    });
  });
});
