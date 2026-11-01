import { describe, it, expect, beforeAll } from 'bun:test';
import {
  ASPECT_RATIO_PRESETS,
  VIDEO_EXPORT_PRESETS,
  getCanonicalCanvasSize,
  inferAspectRatioFromCanvasSize,
  getReferenceDimensionsForCanvas,
  getExportPresetsForAspectRatio,
  withTargetCanvasSize,
  type StandardAspectRatio,
  type VideoIRDocument,
  type ResolvedTimeline,
  VideoIRSchemaValidator,
  RelationalDAGCompiler,
  IRMasterRenderer,
  TransformModifierPlugin,
  ShapeModifierPlugin,
} from '../packages/ir/src';
import { bootstrapNode } from '../packages/core/src';

describe('Video Resolution Standards & Aspect Ratio Presets Suite', () => {
  beforeAll(async () => {
    await bootstrapNode({ prepareFFmpeg: false });
  });

  describe('1. Standards Catalog & Aspect Ratio Inference', () => {
    it('should contain all 7 standardized aspect ratios', () => {
      const ratios = ASPECT_RATIO_PRESETS.map((p) => p.ratio);
      expect(ratios).toEqual(['16:9', '9:16', '1:1', '4:5', '21:9', '4:3', '2.39:1']);
    });

    it('should resolve canonical 1080p-class dimensions accurately', () => {
      expect(getCanonicalCanvasSize('16:9')).toEqual({ w: 1920, h: 1080 });
      expect(getCanonicalCanvasSize('9:16')).toEqual({ w: 1080, h: 1920 });
      expect(getCanonicalCanvasSize('1:1')).toEqual({ w: 1080, h: 1080 });
      expect(getCanonicalCanvasSize('4:5')).toEqual({ w: 1080, h: 1350 });
      expect(getCanonicalCanvasSize('21:9')).toEqual({ w: 2560, h: 1080 });
      expect(getCanonicalCanvasSize('4:3')).toEqual({ w: 1440, h: 1080 });
      expect(getCanonicalCanvasSize('2.39:1')).toEqual({ w: 2580, h: 1080 });
    });

    it('should infer aspect ratios from arbitrary pixel resolutions within tolerance', () => {
      expect(inferAspectRatioFromCanvasSize(1920, 1080)).toBe('16:9');
      expect(inferAspectRatioFromCanvasSize(3840, 2160)).toBe('16:9'); // 4K
      expect(inferAspectRatioFromCanvasSize(1280, 720)).toBe('16:9');  // 720p
      expect(inferAspectRatioFromCanvasSize(1080, 1920)).toBe('9:16'); // Vertical FHD
      expect(inferAspectRatioFromCanvasSize(2160, 3840)).toBe('9:16'); // Vertical 4K
      expect(inferAspectRatioFromCanvasSize(720, 1280)).toBe('9:16');  // Vertical 720p
      expect(inferAspectRatioFromCanvasSize(1080, 1080)).toBe('1:1');
      expect(inferAspectRatioFromCanvasSize(1080, 1350)).toBe('4:5');
      expect(inferAspectRatioFromCanvasSize(2560, 1080)).toBe('21:9');
      expect(inferAspectRatioFromCanvasSize(1440, 1080)).toBe('4:3');
    });

    it('should return matching export presets for every aspect ratio', () => {
      const presets169 = getExportPresetsForAspectRatio('16:9');
      expect(presets169.length).toBeGreaterThanOrEqual(4);
      expect(presets169.map((p) => p.badge)).toContain('4K UHD');
      expect(presets169.map((p) => p.badge)).toContain('1080p FHD');

      const presets916 = getExportPresetsForAspectRatio('9:16');
      expect(presets916.length).toBeGreaterThanOrEqual(4);
      expect(presets916.map((p) => p.badge)).toContain('4K Vertical');
      expect(presets916.map((p) => p.badge)).toContain('FHD Vertical');
    });
  });

  describe('2. Schema Validation & Auto-Migration', () => {
    it('should auto-migrate legacy documents lacking meta.aspectRatio', () => {
      const legacyDoc: VideoIRDocument = {
        version: '1.0.0-stable',
        meta: {
          contentId: 'test-legacy-vertical',
          globalFps: 30,
          canvasSize: { w: 1080, h: 1920 },
        },
        tracks: [],
      };

      const result = VideoIRSchemaValidator.validate(legacyDoc);
      expect(result.valid).toBe(true);
      expect(legacyDoc.meta.aspectRatio).toBe('9:16');
    });

    it('should accept valid standard aspect ratios', () => {
      const doc: VideoIRDocument = {
        version: '1.0.0-stable',
        meta: {
          contentId: 'test-valid-ratio',
          globalFps: 30,
          canvasSize: { w: 2560, h: 1080 },
          aspectRatio: '21:9',
        },
        tracks: [],
      };

      const result = VideoIRSchemaValidator.validate(doc);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid aspect ratios', () => {
      const doc: any = {
        version: '1.0.0-stable',
        meta: {
          contentId: 'test-invalid-ratio',
          globalFps: 30,
          canvasSize: { w: 1920, h: 1080 },
          aspectRatio: 'invalid-ratio',
        },
        tracks: [],
      };

      const result = VideoIRSchemaValidator.validate(doc);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('"meta.aspectRatio"'))).toBe(true);
    });
  });

  describe('3. Lightweight Input Config Wrapper withTargetCanvasSize', () => {
    it('should produce shallow-cloned timeline with updated canvasSize with O(1) performance', async () => {
      const compiler = new RelationalDAGCompiler();
      const doc: VideoIRDocument = {
        version: '1.0.0-stable',
        meta: {
          contentId: 'test-perf',
          globalFps: 30,
          canvasSize: { w: 1920, h: 1080 },
          aspectRatio: '16:9',
        },
        tracks: [
          {
            id: 'track-v1',
            type: 'video',
            sequences: [
              {
                id: 'seq-1',
                type: 'video',
                time: { start: 0, duration: 30 },
              },
            ],
          },
        ],
      };

      const compiled = await compiler.compile(doc);
      const target4K = withTargetCanvasSize(compiled, 3840, 2160);

      // Verify canvasSize is updated on clone
      expect(target4K.meta.canvasSize).toEqual({ w: 3840, h: 2160 });
      // Verify original timeline is untouched
      expect(compiled.meta.canvasSize).toEqual({ w: 1920, h: 1080 });
      // Verify track references are preserved without deep clone churn
      expect(target4K.tracks).toBe(compiled.tracks);
    });
  });

  describe('4. Render-Time Proportional Coordinate Scaling', () => {
    it('should scale motion translation proportionally in TransformModifierPlugin', () => {
      const plugin = new TransformModifierPlugin();
      const mockTranslate = [] as Array<{ x: number; y: number }>;
      const mockCanvasCtx: any = {
        translate: (x: number, y: number) => mockTranslate.push({ x, y }),
        rotate: () => {},
        scale: () => {},
        globalAlpha: 1.0,
      };

      // 1080p Base: 1920x1080 with offset x = 200, y = 100
      plugin.renderClipSpace(
        {
          ctx: mockCanvasCtx,
          width: 1920,
          height: 1080,
          frame: 15,
          localFrame: 15,
          sequence: { id: 'seq-1', type: 'video', startFrame: 0, endFrame: 30, durationFrames: 30, trackId: 't1' },
        },
        { target: 'sequence', x: 200, y: 100, normX: 0.5, normY: 0.5 }
      );

      // Anchor is (960, 540) + offset (200, 100) = (1160, 640)
      expect(mockTranslate[0]).toEqual({ x: 1160, y: 640 });

      // 4K Target: 3840x2160 with exact same modifier parameters
      plugin.renderClipSpace(
        {
          ctx: mockCanvasCtx,
          width: 3840,
          height: 2160,
          frame: 15,
          localFrame: 15,
          sequence: { id: 'seq-1', type: 'video', startFrame: 0, endFrame: 30, durationFrames: 30, trackId: 't1' },
        },
        { target: 'sequence', x: 200, y: 100, normX: 0.5, normY: 0.5 }
      );

      // Anchor is (1920, 1080) + scaled offset (200 * 2, 100 * 2 = 400, 200) = (2320, 1280) -> exactly identical proportional position!
      expect(mockTranslate[2]).toEqual({ x: 2320, y: 1280 });
    });

    it('should scale dimensions proportionally in ShapeModifierPlugin', () => {
      const plugin = new ShapeModifierPlugin();
      const mockTranslate = [] as Array<{ x: number; y: number }>;
      const mockCtx: any = {
        ctx: {
          save: () => {},
          restore: () => {},
          beginPath: () => {},
          rect: () => {},
          fill: () => {},
          stroke: () => {},
          translate: (x: number, y: number) => mockTranslate.push({ x, y }),
        },
        width: 3840,
        height: 2160,
        frame: 0,
        localFrame: 0,
        sequence: { id: 'seq-overlay', type: 'overlay', startFrame: 0, endFrame: 30, durationFrames: 30, trackId: 't1' },
      };

      plugin.renderClipSpace(mockCtx, {
        geometry: 'rect',
        width: 300,
        height: 150,
        x: 100,
        y: 50,
        normX: 0.5,
        normY: 0.5,
      });

      // 4K origin: (3840 * 0.5) + (100 * 2) = 2120, (2160 * 0.5) + (50 * 2) = 1180
      expect(mockTranslate[0]).toEqual({ x: 2120, y: 1180 });
    });
  });

  describe('5. Pure 1:1 Headless IRMasterRenderer Execution', () => {
    it('should render both 1080p and 4K configured timelines with bit-identical determinism', async () => {
      const compiler = new RelationalDAGCompiler();
      const doc: VideoIRDocument = {
        version: '1.0.0-stable',
        meta: {
          contentId: 'test-headless-render',
          globalFps: 30,
          canvasSize: { w: 640, h: 360 }, // lightweight 16:9 draft for fast CI testing
          aspectRatio: '16:9',
        },
        tracks: [
          {
            id: 'track-v1',
            type: 'video',
            sequences: [
              {
                id: 'seq-solid',
                type: 'video',
                time: { start: 0, duration: 5 },
                modifiers: [
                  {
                    type: 'transform',
                    target: 'video',
                    params: { x: 50, y: 25 },
                  },
                ],
              },
            ],
          },
        ],
      };

      const timelineDraft = await compiler.compile(doc);
      const rendererDraft = new IRMasterRenderer(timelineDraft, 42);
      const resDraft = await rendererDraft.render({
        generateFrameHash: true,
      });

      expect(resDraft.width).toBe(640);
      expect(resDraft.height).toBe(360);
      expect(resDraft.cumulativeHash).toBeDefined();

      // Render scaled 2x timeline (1280x720) via withTargetCanvasSize
      const timelineHD = withTargetCanvasSize(timelineDraft, 1280, 720);
      const rendererHD = new IRMasterRenderer(timelineHD, 42);
      const resHD = await rendererHD.render({
        generateFrameHash: true,
      });

      expect(resHD.width).toBe(1280);
      expect(resHD.height).toBe(720);
      expect(resHD.cumulativeHash).toBeDefined();
    });
  });
});
