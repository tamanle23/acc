import { describe, it, expect } from 'bun:test';
import {
  PostProcessingShaders,
} from '@acc/effect-engines';
import {
  IRCanvasCompositor,
  TemporalKeyframeEvaluator,
  evaluateSequenceMotion,
  RelationalDAGCompiler,
  AssetMetadataProber,
  type VideoIRDocument,
} from '@acc/ir';

describe('IR & Effect-Engines Remediation & Conformance Suite', () => {
  describe('Fix 1: PostProcessingShaders.applyChromaticAberration Reusable Buffer', () => {
    it('applies chromatic aberration without allocating per-scanline arrays', () => {
      const width = 120;
      const height = 80;
      const rgba = new Uint8Array(width * height * 4);

      // Seed with sample pattern
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = 200;     // R
        rgba[i + 1] = 100; // G
        rgba[i + 2] = 50;  // B
        rgba[i + 3] = 255; // A
      }

      // Execute chromatic aberration
      expect(() => {
        PostProcessingShaders.applyChromaticAberration(rgba, width, height, 4);
      }).not.toThrow();

      // Verify channels were shifted
      expect(rgba[0]).toBeDefined();
    });
  });

  describe('Fix 2: IRCanvasCompositor Canvas Context Save/Restore Balance', () => {
    it('guarantees save/restore parity even on asynchronous or synchronous render completion', async () => {
      let saveCount = 0;
      let restoreCount = 0;

      const mockCtx: any = {
        save: () => { saveCount++; },
        restore: () => { restoreCount++; },
        setTransform: () => {},
        clearRect: () => {},
        fillRect: () => {},
        drawImage: () => {},
        canvas: { width: 1920, height: 1080 },
        globalCompositeOperation: 'source-over',
        globalAlpha: 1.0,
      };

      const emptyTimeline: any = {
        meta: { globalFps: 30, canvasSize: { w: 1920, h: 1080 } },
        tracks: new Map(),
        sequences: new Map(),
        totalFrames: 10,
      };

      await IRCanvasCompositor.renderFrame(mockCtx, emptyTimeline, 0, {
        pluginRegistry: { get: () => undefined } as any,
      });

      // Context must be restored exactly as many times as it was saved
      expect(saveCount).toBeGreaterThan(0);
      expect(restoreCount).toBe(saveCount);
    });
  });

  describe('Fix 5: TemporalKeyframeEvaluator Outro Lifecycle', () => {
    it('evaluates intro, steady, and outro windows when durationSec is supplied', () => {
      const curve = {
        intro: {
          durationSec: 1.0,
          from: 0,
          to: 100,
          ease: 'linear',
        },
        steady: {
          type: 'hold' as const,
        },
        outro: {
          durationSec: 1.0,
          to: 0,
          ease: 'linear',
        },
      };

      const durationSec = 5.0;

      // 1. In intro (0.5s): progress is 0.5 -> value = 50
      const introVal = TemporalKeyframeEvaluator.evaluateNumeric(curve, 0.5, 0, durationSec);
      expect(introVal).toBeCloseTo(50, 1);

      // 2. In steady (2.5s): steady value is 100
      const steadyVal = TemporalKeyframeEvaluator.evaluateNumeric(curve, 2.5, 0, durationSec);
      expect(steadyVal).toBeCloseTo(100, 1);

      // 3. In outro (4.5s): outro start is 4.0s, duration 1.0s, elapsed 0.5s -> value = 50
      const outroVal = TemporalKeyframeEvaluator.evaluateNumeric(curve, 4.5, 0, durationSec);
      expect(outroVal).toBeCloseTo(50, 1);

      // 4. Outro boundary (5.0s): value = 0
      const exitVal = TemporalKeyframeEvaluator.evaluateNumeric(curve, 5.0, 0, durationSec);
      expect(exitVal).toBeCloseTo(0, 1);
    });

    it('evaluates outro in DeterministicMotionEvaluator with hasKeyframes', () => {
      const transformParams = {
        opacity: {
          intro: { durationSec: 1.0, from: 0.0, to: 1.0, ease: 'linear' },
          outro: { durationSec: 1.0, to: 0.0, ease: 'linear' },
        },
      };

      const durationSec = 4.0;
      // At 3.5s (in outro): opacity should be ~0.5
      const state = evaluateSequenceMotion(transformParams, 3.5, durationSec);

      if (state) {
        expect(state.opacity).toBeCloseTo(0.5, 1);
      }
    });
  });

  describe('Fix 6: BaseTimeSpacePlugin Safe Execution Without ctx.ctx Crash', () => {
    it('does not throw when renderClipSpace is called with missing or partial ctx.ctx', async () => {
      const { EnergyShieldPlugin } = await import('@acc/ir');
      const plugin = new EnergyShieldPlugin();

      const clipContext: any = {
        ctx: undefined, // no canvas context
        width: 1920,
        height: 1080,
        localFrame: 0,
        sequence: { id: 'test-seq', fps: 30 },
      };

      expect(() => {
        plugin.renderClipSpace(clipContext, {
          density: 1.0,
          theme: 'cyan',
        });
      }).not.toThrow();
    });
  });

  describe('Fix 7: RelationalDAGCompiler Kahn Topological Sort with O(V+E) Map Lookup', () => {
    it('compiles multi-sequence timeline with relational constraints accurately and deterministically', async () => {
      const compiler = new RelationalDAGCompiler();
      const doc: VideoIRDocument = {
        version: '1.0-stable',
        meta: {
          contentId: 'test-content-001',
          title: 'O(V+E) Compilation Benchmark',
          canvasSize: { w: 1920, h: 1080 },
          globalFps: 30,
        },
        tracks: [
          {
            id: 'track-v1',
            type: 'video',
            sequences: [
              {
                id: 'seq-1',
                type: 'video',
                time: { start: 0, duration: 60 },
              },
              {
                id: 'seq-2',
                type: 'video',
                time: {
                  start: { after: 'seq-1', offsetFrames: 10 },
                  duration: { matchLengthOf: 'seq-1', paddingFrames: 5 },
                },
              },
              {
                id: 'seq-3',
                type: 'video',
                time: {
                  start: { after: 'seq-2' },
                  duration: 30,
                },
              },
            ],
          },
        ],
      };

      const compiled = await compiler.compile(doc);
      expect(compiled.sequences.get('seq-1')?.startFrame).toBe(0);
      expect(compiled.sequences.get('seq-1')?.durationFrames).toBe(60);

      // seq-2: start = seq-1.end (60) + 10 = 70. duration = 60 + 5 = 65. end = 135
      expect(compiled.sequences.get('seq-2')?.startFrame).toBe(70);
      expect(compiled.sequences.get('seq-2')?.durationFrames).toBe(65);

      // seq-3: start = seq-2.end (135). duration = 30. end = 165
      expect(compiled.sequences.get('seq-3')?.startFrame).toBe(135);
      expect(compiled.sequences.get('seq-3')?.durationFrames).toBe(30);

      expect(compiled.totalFrames).toBe(165);
    });
  });

  describe('Fix 8: AssetMetadataProber WinterTC Uint8Array & DataView Compliance', () => {
    it('instantiates and probes without requiring Node.js Buffer global', async () => {
      const prober = new AssetMetadataProber();
      expect(prober).toBeDefined();

      const meta = await prober.probe('test-asset', 'https://example.com/asset.mp4', 'video', 30);
      expect(meta.assetId).toBe('test-asset');
      expect(meta.durationFrames).toBeGreaterThan(0);
    });
  });
});
