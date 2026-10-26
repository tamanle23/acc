import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import {
  VisionEngineRegistry,
  VisionDomain,
  DepthStrategyId,
  SegmentationStrategyId,
  HeuristicDepthStrategy,
  GrabCutFallbackStrategy,
  PlatformDetector,
  RuntimeEnvironment,
} from '../packages/core-isomorphic/src';
import { bootstrapNode } from '../packages/core/src/bootstrap';

describe('VisionEngineRegistry & Isomorphic Vision Architecture (@acc/core-isomorphic)', () => {
  beforeAll(async () => {
    await bootstrapNode();
  });

  beforeEach(() => {
    VisionEngineRegistry.reset();
  });

  describe('Registry Invariants & Strategy Lifecycle', () => {
    it('registers and retrieves HeuristicDepthStrategy', () => {
      const heuristic = new HeuristicDepthStrategy();
      VisionEngineRegistry.registerDepthStrategy(heuristic, true);

      expect(VisionEngineRegistry.hasDepthStrategy(DepthStrategyId.Heuristic)).toBe(true);
      const retrieved = VisionEngineRegistry.getDepthStrategy();
      expect(retrieved.id).toBe(DepthStrategyId.Heuristic);
      expect(retrieved.name).toBe('heuristic-depth');
    });

    it('registers and retrieves GrabCutFallbackStrategy', () => {
      const grabcut = new GrabCutFallbackStrategy();
      VisionEngineRegistry.registerSegmentationStrategy(grabcut, true);

      expect(VisionEngineRegistry.hasSegmentationStrategy(SegmentationStrategyId.GrabCutFallback)).toBe(true);
      const retrieved = VisionEngineRegistry.getSegmentationStrategy();
      expect(retrieved.id).toBe(SegmentationStrategyId.GrabCutFallback);
      expect(retrieved.name).toBe('grabcut-fallback');
    });

    it('throws typed VisionEngineError on unregistered strategy retrieval', () => {
      expect(() => VisionEngineRegistry.getDepthStrategy('non-existent')).toThrow(
        /\[VisionEngine:depth:non-existent\]/
      );
    });

    it('allows changing default strategies explicitly', () => {
      const heuristic = new HeuristicDepthStrategy();
      VisionEngineRegistry.registerDepthStrategy(heuristic);
      VisionEngineRegistry.setDefaultDepthStrategy(DepthStrategyId.Heuristic);

      expect(VisionEngineRegistry.getDefaultDepthStrategyId()).toBe(DepthStrategyId.Heuristic);
    });
  });

  describe('PlatformDetector Vision Resolution', () => {
    it('resolves server neural defaults in Node/Bun environment', () => {
      const defaultDepth = PlatformDetector.resolveDefaultDepthStrategy();
      const defaultSeg = PlatformDetector.resolveDefaultSegmentationStrategy();

      expect(defaultDepth).toBe(DepthStrategyId.DepthAnythingV2Small);
      expect(defaultSeg).toBe(SegmentationStrategyId.Rmbg14);
    });
  });

  describe('Isomorphic Execution & Zero-Download Fallback', () => {
    it('executes HeuristicDepthStrategy with synthetic pixel buffer', async () => {
      const strategy = new HeuristicDepthStrategy();
      const w = 100;
      const h = 100;
      const data = new Uint8Array(w * h * 4);
      // Fill with gradient
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 200;
        data[i + 1] = 100;
        data[i + 2] = 50;
        data[i + 3] = 255;
      }

      const res = await strategy.estimateDepth({ data, width: w, height: h });
      expect(res.width).toBe(w);
      expect(res.height).toBe(h);
      expect(res.depth16Data.length).toBe(w * h);
      expect(res.minDepth).toBe(0.5);
      expect(res.maxDepth).toBe(8.5);
      expect(res.modelUsed).toBe(DepthStrategyId.Heuristic);
    });

    it('executes GrabCutFallbackStrategy with bounding box', async () => {
      const strategy = new GrabCutFallbackStrategy();
      const w = 100;
      const h = 100;
      const data = new Uint8Array(w * h * 4).fill(128);

      const res = await strategy.segment(
        { data, width: w, height: h },
        { box: [0.2, 0.2, 0.8, 0.8] }
      );

      expect(res.width).toBe(w);
      expect(res.height).toBe(h);
      expect(res.maskAlphaData.length).toBe(w * h);
      expect(res.confidence).toBeGreaterThan(0.8);
      expect(res.modelUsed).toBe(SegmentationStrategyId.GrabCutFallback);
    });
  });
});
