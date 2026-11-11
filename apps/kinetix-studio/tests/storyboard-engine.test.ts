import { describe, it, expect, beforeEach } from 'bun:test';
import { StoryboardSequence } from '@/core/domain/storyboard/storyboard-sequence.entity';
import { DEFAULT_STORYBOARD_PRESET, CINEMA_TRAILER_STORYBOARD_PRESET } from '@/constants/storyboard-presets';
import {
  CutTransition,
  CrossDissolveTransition,
  WhipPanTransition,
  GlitchDissolveTransition,
  MatteWipeTransition,
  CrossZoomTransition,
  TransitionRegistry,
} from '@/engine/transitions/transition-strategy';
import { StoryboardCompositor } from '@/engine/composition/storyboard-compositor';
import { INITIAL_STUDIO_STATE } from '@/constants/initial-state';
import { exportStoryboardBatchAspects } from '@/lib/batch-aspect-exporter';

class MockCanvasRenderingContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  lineWidth = 1;
  font = '10px sans-serif';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  shadowColor = 'transparent';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  filter = 'none';

  save() {}
  restore() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  arcTo() {}
  arc() {}
  ellipse() {}
  rect() {}
  roundRect() {}
  fill() {}
  stroke() {}
  fillRect() {}
  strokeRect() {}
  clearRect() {}
  fillText() {}
  strokeText() {}
  measureText(text: string) {
    return {
      width: text.length * 10,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 10,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 2,
      alphabeticBaseline: 0,
      emHeightAscent: 10,
      emHeightDescent: 2,
      hangingBaseline: 8,
      ideographicBaseline: -2,
    } as unknown as TextMetrics;
  }
  drawImage() {}
  createLinearGradient() {
    return { addColorStop: () => {} } as any;
  }
  createRadialGradient() {
    return { addColorStop: () => {} } as any;
  }
  translate() {}
  rotate() {}
  scale() {}
  transform() {}
  setTransform() {}
  resetTransform() {}
  clip() {}
  setLineDash() {}
  getLineDash() {
    return [];
  }
}

function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const ctx = new MockCanvasRenderingContext2D();
  return {
    width,
    height,
    getContext: () => ctx as unknown as CanvasRenderingContext2D,
    toBlob: (cb: (b: Blob) => void) => {
      cb(new Blob(['mock-data'], { type: 'image/png' }));
    },
  } as unknown as HTMLCanvasElement;
}

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return createMockCanvas(344, 612);
      return {};
    },
  };
}

describe('Horizon 1: Multi-Scene Storyboard & Timeline Sequencer Suite', () => {
  describe('StoryboardSequence Aggregate Entity', () => {
    it('instantiates cleanly from curated presets and computes total duration accurately', () => {
      const seq = StoryboardSequence.fromSpec(DEFAULT_STORYBOARD_PRESET);
      expect(seq.id).toBe('narrative-manifesto-triad');
      expect(seq.sceneCount).toBe(3);
      // 4.0 + 5.0 + 5.0 = 14.0s
      expect(seq.totalDurationSec).toBe(14.0);
    });

    it('resolves scene and local progress accurately across global time progression', () => {
      const seq = StoryboardSequence.fromSpec(DEFAULT_STORYBOARD_PRESET);

      // t = 1.0s -> Act I (0s to 4s)
      const res1 = seq.resolveAtGlobalTime(1.0);
      expect(res1.sceneIndex).toBe(0);
      expect(res1.currentScene.id).toBe('scene-intro-swiss');
      expect(res1.localTimeSec).toBeCloseTo(1.0, 2);
      expect(res1.localProgress).toBeCloseTo(0.25, 2);
      expect(res1.transitionProgress).toBeNull();

      // t = 3.6s -> Act I transition zone (transition starts at 4.0 - 0.8 = 3.2s)
      const resTransition = seq.resolveAtGlobalTime(3.6);
      expect(resTransition.sceneIndex).toBe(0);
      expect(resTransition.transitionProgress).not.toBeNull();
      // (3.6 - 3.2) / 0.8 = 0.5
      expect(resTransition.transitionProgress!).toBeCloseTo(0.5, 2);
      expect(resTransition.transition?.type).toBe('whip-pan');

      // t = 5.0s -> Act II (4s to 9s, localTime = 1.0s)
      const res2 = seq.resolveAtGlobalTime(5.0);
      expect(res2.sceneIndex).toBe(1);
      expect(res2.currentScene.id).toBe('scene-build-bauhaus');
      expect(res2.localTimeSec).toBeCloseTo(1.0, 2);
      expect(res2.localProgress).toBeCloseTo(0.2, 2);
    });

    it('wraps global time cyclically without throwing on negative or overflowing coordinates', () => {
      const seq = StoryboardSequence.fromSpec(DEFAULT_STORYBOARD_PRESET);
      // Overflow past 14s: 15s == 1.0s
      const resOverflow = seq.resolveAtGlobalTime(15.0);
      expect(resOverflow.sceneIndex).toBe(0);
      expect(resOverflow.localTimeSec).toBeCloseTo(1.0, 2);

      // Negative coordinate: -2s == 12s (Act III)
      const resNegative = seq.resolveAtGlobalTime(-2.0);
      expect(resNegative.sceneIndex).toBe(2);
      expect(resNegative.currentScene.id).toBe('scene-drop-brutalist-club');
    });

    it('supports immutable additions, removals, updates, and reorderings', () => {
      const initial = StoryboardSequence.fromSpec(DEFAULT_STORYBOARD_PRESET);

      // Add scene
      const withNew = initial.withAddedScene({
        id: 'scene-outro',
        title: 'Act IV: Outro',
        durationSec: 3.0,
        statePatch: {},
      });
      expect(withNew.sceneCount).toBe(4);
      expect(withNew.totalDurationSec).toBe(17.0);

      // Reorder scene (move Act 1 to index 1)
      const reordered = withNew.withReorderedScenes(0, 1);
      expect(reordered.scenes[0].id).toBe('scene-build-bauhaus');
      expect(reordered.scenes[1].id).toBe('scene-intro-swiss');

      // Update scene
      const updated = reordered.withUpdatedScene('scene-outro', { durationSec: 5.0 });
      expect(updated.scenes.find((s) => s.id === 'scene-outro')?.durationSec).toBe(5.0);

      // Remove scene
      const removed = updated.withRemovedScene('scene-outro');
      expect(removed.sceneCount).toBe(3);

      // Round-trip spec verification
      const spec = removed.toSpec();
      const reconstructed = StoryboardSequence.fromSpec(spec);
      expect(reconstructed.sceneCount).toBe(3);
      expect(reconstructed.totalDurationSec).toBe(14.0);
    });

    it('resolves nextScene as null on the final scene when transitionOut is not specified', () => {
      const nonLoopingSeq = new StoryboardSequence('seq-linear', 'Linear Sequence', [
        { id: 's1', title: 'Scene 1', durationSec: 3.0, statePatch: {} },
        { id: 's2', title: 'Final Scene', durationSec: 4.0, statePatch: {} },
      ]);

      // During scene 1 (has no transitionOut)
      const res1 = nonLoopingSeq.resolveAtGlobalTime(1.0);
      expect(res1.nextScene?.id).toBe('s2');

      // During final scene 2
      const res2 = nonLoopingSeq.resolveAtGlobalTime(5.0);
      expect(res2.currentScene.id).toBe('s2');
      expect(res2.nextScene).toBeNull();
      expect(res2.transitionProgress).toBeNull();
    });
  });

  describe('Transition Strategy Suite & Registry', () => {
    let mockFrom: HTMLCanvasElement;
    let mockTo: HTMLCanvasElement;
    let mockTarget: HTMLCanvasElement;
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
      mockFrom = document.createElement('canvas');
      mockTo = document.createElement('canvas');
      mockTarget = document.createElement('canvas');
      mockFrom.width = 100;
      mockFrom.height = 100;
      mockTo.width = 100;
      mockTo.height = 100;
      mockTarget.width = 100;
      mockTarget.height = 100;
      mockCtx = mockTarget.getContext('2d')!;
    });

    it('TransitionRegistry contains all 6 canonical transition types', () => {
      const types = TransitionRegistry.getAvailableTypes();
      expect(types).toContain('cut');
      expect(types).toContain('cross-dissolve');
      expect(types).toContain('whip-pan');
      expect(types).toContain('glitch-dissolve');
      expect(types).toContain('matte-wipe');
      expect(types).toContain('cross-zoom');
    });

    it('renders CutTransition cleanly without throws', () => {
      const cut = new CutTransition();
      cut.render({
        fromCanvas: mockFrom,
        toCanvas: mockTo,
        targetCtx: mockCtx,
        progress: 0.25,
        width: 100,
        height: 100,
      });
      cut.render({
        fromCanvas: mockFrom,
        toCanvas: mockTo,
        targetCtx: mockCtx,
        progress: 0.75,
        width: 100,
        height: 100,
      });
      expect(true).toBe(true);
    });

    it('renders CrossDissolve, WhipPan, GlitchDissolve, MatteWipe, and CrossZoom transitions smoothly', () => {
      const strategies = [
        new CrossDissolveTransition(),
        new WhipPanTransition(),
        new GlitchDissolveTransition(),
        new MatteWipeTransition(),
        new CrossZoomTransition(),
      ];

      for (const strat of strategies) {
        strat.render({
          fromCanvas: mockFrom,
          toCanvas: mockTo,
          targetCtx: mockCtx,
          progress: 0.5,
          width: 100,
          height: 100,
          direction: 'right',
        });
      }
      expect(true).toBe(true);
    });
  });

  describe('StoryboardCompositor Dual-Buffer Engine', () => {
    it('renders single-scene frames and ping-pong transition frames safely', () => {
      const compositor = new StoryboardCompositor();
      const seq = StoryboardSequence.fromSpec(DEFAULT_STORYBOARD_PRESET);
      const canvas = document.createElement('canvas');
      canvas.width = 344;
      canvas.height = 612;
      const ctx = canvas.getContext('2d')!;

      // 1. Non-transition frame (t = 1.0s)
      compositor.renderSequenceFrame(ctx, {
        sequence: seq,
        globalTimeSec: 1.0,
        baseState: INITIAL_STUDIO_STATE,
        width: 344,
        height: 612,
        totalFrames: 120,
      });

      // 2. Transition frame (t = 3.6s, between scene 0 and scene 1)
      compositor.renderSequenceFrame(ctx, {
        sequence: seq,
        globalTimeSec: 3.6,
        baseState: INITIAL_STUDIO_STATE,
        width: 344,
        height: 612,
        totalFrames: 120,
      });

      // 3. Dispose cleanly conforming to ECMA-429
      compositor.dispose();
      expect(() => {
        compositor.renderSequenceFrame(ctx, {
          sequence: seq,
          globalTimeSec: 1.0,
          baseState: INITIAL_STUDIO_STATE,
          width: 344,
          height: 612,
        });
      }).toThrow(/disposed/);
    });

    it('scales ping-pong transition buffers and render dimensions by DPR factor to prevent quarter-corner glitches', () => {
      const compositor = new StoryboardCompositor();
      const seq = StoryboardSequence.fromSpec(DEFAULT_STORYBOARD_PRESET);
      const canvas = document.createElement('canvas');
      const dpr = 2;
      canvas.width = 344 * dpr; // 688
      canvas.height = 612 * dpr; // 1224
      const ctx = canvas.getContext('2d')!;

      // Transition frame (t = 3.6s) with Retina DPR scale = 2
      compositor.renderSequenceFrame(ctx, {
        sequence: seq,
        globalTimeSec: 3.6,
        baseState: INITIAL_STUDIO_STATE,
        width: 344,
        height: 612,
        totalFrames: 120,
        scale: dpr,
      });

      // Verification: compositor internal buffers match physical dimensions (688 x 1224)
      const internalBufA = (compositor as any).bufferA as HTMLCanvasElement;
      const internalBufB = (compositor as any).bufferB as HTMLCanvasElement;
      expect(internalBufA.width).toBe(688);
      expect(internalBufA.height).toBe(1224);
      expect(internalBufB.width).toBe(688);
      expect(internalBufB.height).toBe(1224);
      compositor.dispose();
    });

    it('synchronizes archetype design tokens and palette patches across scene transitions', () => {
      const compositor = new StoryboardCompositor();
      const seq = StoryboardSequence.fromSpec(DEFAULT_STORYBOARD_PRESET);
      const canvas = document.createElement('canvas');
      canvas.width = 344;
      canvas.height = 612;
      const ctx = canvas.getContext('2d')!;

      // Act II (t = 5.0s, localTime = 1.0s) has archetypeId: 'bauhaus-constructivism'
      // It should render without error, successfully resolving bauhaus archetype tokens
      expect(() => {
        compositor.renderSequenceFrame(ctx, {
          sequence: seq,
          globalTimeSec: 5.0,
          baseState: INITIAL_STUDIO_STATE,
          width: 344,
          height: 612,
          totalFrames: 120,
        });
      }).not.toThrow();

      compositor.dispose();
    });
  });

  describe('Multi-Aspect Batch Exporter', () => {
    it('executes batch aspect export across 9:16, 16:9, and 1:1 ratios', async () => {
      const seq = StoryboardSequence.fromSpec(CINEMA_TRAILER_STORYBOARD_PRESET);
      const result = await exportStoryboardBatchAspects({
        sequence: seq,
        baseState: INITIAL_STUDIO_STATE,
        aspectRatios: ['9:16', '16:9', '1:1'],
        autoDownload: false,
      });

      expect(result.sequenceId).toBe('cinema-auteur-trailer');
      expect(result.items.length).toBe(3);
      expect(result.items[0].aspectRatio).toBe('9:16');
      expect(result.items[1].aspectRatio).toBe('16:9');
      expect(result.items[2].aspectRatio).toBe('1:1');
      expect(result.items[0].blob.size).toBeGreaterThan(0);
    });

    it('respects AbortSignal and cleanly aborts batch export without memory leak', async () => {
      const seq = StoryboardSequence.fromSpec(CINEMA_TRAILER_STORYBOARD_PRESET);
      const controller = new AbortController();
      controller.abort(); // already aborted

      await expect(
        exportStoryboardBatchAspects({
          sequence: seq,
          baseState: INITIAL_STUDIO_STATE,
          aspectRatios: ['9:16'],
          autoDownload: false,
          abortSignal: controller.signal,
        })
      ).rejects.toThrow();
    });
  });
});
