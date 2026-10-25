import { describe, it, expect, beforeAll } from 'bun:test';
import { createCanvas } from '@napi-rs/canvas';
import {
  SubjectSegmentationContext,
  DepthEstimationContext,
  SlimSamStrategy,
  SamVitBaseStrategy,
  GrabCutFallbackStrategy,
  DepthAnythingV2SmallStrategy,
  HeuristicDepthStrategy,
  createCutoutRgba,
  type ISegmentationStrategy,
  type IDepthEstimationStrategy,
  type SegmentationResult,
  type DepthResult
} from '../packages/effect-engines/src/vision';

describe('Vision Strategy Pattern Suite (@huggingface/transformers + Zero-Crash Fallbacks)', () => {
  let testImageBuffer: Buffer;

  beforeAll(() => {
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

  describe('SubjectSegmentationContext & Strategies', () => {
    it('should initialize with default RMBG-1.4 strategy', () => {
      const segContext = SubjectSegmentationContext.getInstance();
      expect(segContext.getActiveStrategyName()).toBe('rmbg-1.4');
    });

    it('should switch strategies dynamically via useStrategy', () => {
      const segContext = SubjectSegmentationContext.getInstance();
      segContext.useStrategy('grabcut');
      expect(segContext.getActiveStrategyName()).toBe('grabcut-fallback');

      segContext.useStrategy('sam-vit-base');
      expect(segContext.getActiveStrategyName()).toBe('sam-vit-base');

      segContext.useStrategy('sam2-tiny');
      expect(segContext.getActiveStrategyName()).toBe('sam2-tiny');

      segContext.useStrategy('rmbg-1.4');
      expect(segContext.getActiveStrategyName()).toBe('rmbg-1.4');

      segContext.useStrategy('birefnet-general');
      expect(segContext.getActiveStrategyName()).toBe('birefnet-general');

      segContext.useStrategy('slimsam');
      expect(segContext.getActiveStrategyName()).toBe('slimsam');
    });

    it('should execute GrabCutFallbackStrategy and return valid mask buffer', async () => {
      const segContext = SubjectSegmentationContext.getInstance();
      segContext.useStrategy('grabcut');

      const result = await segContext.segment(testImageBuffer);
      expect(result).toBeDefined();
      expect(result.width).toBe(320);
      expect(result.height).toBe(240);
      expect(result.maskRgbaBuffer).toBeDefined();
      expect(Buffer.isBuffer(result.maskRgbaBuffer)).toBe(true);
      expect(result.maskRgbaBuffer.length).toBeGreaterThan(100);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should allow injecting custom segmentation strategy', async () => {
      class MockCustomStrategy implements ISegmentationStrategy {
        public readonly name = 'mock-custom-seg';
        async segment(imageBuffer: Buffer): Promise<SegmentationResult> {
          return {
            maskRgbaBuffer: imageBuffer,
            width: 100,
            height: 100,
            confidence: 0.99,
            boundingBox: { x: 0, y: 0, width: 100, height: 100 }
          };
        }
      }

      const segContext = SubjectSegmentationContext.getInstance();
      segContext.setStrategy(new MockCustomStrategy());
      expect(segContext.getActiveStrategyName()).toBe('mock-custom-seg');

      const result = await segContext.segment(testImageBuffer);
      expect(result.confidence).toBe(0.99);
      expect(result.width).toBe(100);

      // Restore default strategy
      segContext.useStrategy('slimsam');
    });

    it('should defensively catch throwing strategy and fallback to GrabCut without crashing', async () => {
      class FailingStrategy implements ISegmentationStrategy {
        public readonly name = 'failing-strategy';
        async segment(): Promise<SegmentationResult> {
          throw new Error('Simulated ONNX / GPU memory failure');
        }
      }

      const segContext = SubjectSegmentationContext.getInstance();
      segContext.setStrategy(new FailingStrategy());

      // Should not throw, but fallback gracefully
      const result = await segContext.segment(testImageBuffer);
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result.maskRgbaBuffer)).toBe(true);
      expect(result.maskRgbaBuffer.length).toBeGreaterThan(0);

      // Restore
      segContext.useStrategy('slimsam');
    });
  });

  describe('DepthEstimationContext & Strategies', () => {
    it('should initialize with default Depth Anything v2 Small strategy', () => {
      const depthContext = DepthEstimationContext.getInstance();
      expect(depthContext.getActiveStrategyName()).toBe('depth-anything-v2-small');
    });

    it('should switch depth strategies dynamically via useStrategy', () => {
      const depthContext = DepthEstimationContext.getInstance();
      depthContext.useStrategy('heuristic');
      expect(depthContext.getActiveStrategyName()).toBe('heuristic-depth');

      depthContext.useStrategy('depth-anything-v2-base');
      expect(depthContext.getActiveStrategyName()).toBe('depth-anything-v2-base');

      depthContext.useStrategy('glpn-metric');
      expect(depthContext.getActiveStrategyName()).toBe('glpn-metric');

      depthContext.useStrategy('dpt-large');
      expect(depthContext.getActiveStrategyName()).toBe('dpt-large');

      depthContext.useStrategy('depth-anything-v2-small');
      expect(depthContext.getActiveStrategyName()).toBe('depth-anything-v2-small');
    });

    it('should execute HeuristicDepthStrategy and return 16-bit depth buffer', async () => {
      const depthContext = DepthEstimationContext.getInstance();
      depthContext.useStrategy('heuristic');

      const result = await depthContext.estimateDepth(testImageBuffer);
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
        public readonly name = 'mock-custom-depth';
        async estimateDepth(imageBuffer: Buffer): Promise<DepthResult> {
          return {
            depth16Buffer: imageBuffer,
            width: 200,
            height: 150,
            minDepth: 0.1,
            maxDepth: 0.9
          };
        }
      }

      const depthContext = DepthEstimationContext.getInstance();
      depthContext.setStrategy(new MockDepthStrategy());
      expect(depthContext.getActiveStrategyName()).toBe('mock-custom-depth');

      const result = await depthContext.estimateDepth(testImageBuffer);
      expect(result.minDepth).toBe(0.1);
      expect(result.maxDepth).toBe(0.9);

      // Restore
      depthContext.useStrategy('depth-anything-v2-small');
    });

    it('should defensively catch throwing depth strategy and fallback to Heuristic without crashing', async () => {
      class FailingDepthStrategy implements IDepthEstimationStrategy {
        public readonly name = 'failing-depth';
        async estimateDepth(): Promise<DepthResult> {
          throw new Error('Simulated model download / network failure');
        }
      }

      const depthContext = DepthEstimationContext.getInstance();
      depthContext.setStrategy(new FailingDepthStrategy());

      const result = await depthContext.estimateDepth(testImageBuffer);
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result.depth16Buffer)).toBe(true);
      expect(result.depth16Buffer.length).toBeGreaterThan(0);

      // Restore
      depthContext.useStrategy('depth-anything-v2-small');
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
