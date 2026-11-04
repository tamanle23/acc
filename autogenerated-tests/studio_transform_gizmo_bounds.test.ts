import { describe, it, expect } from 'bun:test';
import { CanvasHitTester } from '../apps/studio/src/lib/hit-test/CanvasHitTester';
import { TYPOGRAPHY_PRESETS } from '../apps/studio/src/lib/library/typographyBank';
import { SHAPE_PRESETS } from '../apps/studio/src/lib/library/shapesBank';
import {
  Gizmo2DTransformation,
  type BoundingBox2D,
} from '../apps/studio/src/lib/gizmo/Gizmo2DTransformation';
import {
  TransformModifierPlugin,
  TextModifierPlugin,
} from '@acc/ir';

describe('Studio Transform Gizmo Bounds & Alignment Suite', () => {
  describe('CanvasHitTester.resolveSequenceBounds', () => {
    it('computes accurate bounds for text/draw with configurable 8px breathing padding', () => {
      const preset = TYPOGRAPHY_PRESETS[0]; // 24K Gold Epic Title
      const seq = preset.createSequence({
        startFrame: 0,
        durationFrames: 90,
        normX: 0.5,
        normY: 0.45,
      });

      const boundsPadded = CanvasHitTester.resolveSequenceBounds(seq as any, 1920, 1080, 8);
      const boundsZeroPad = CanvasHitTester.resolveSequenceBounds(seq as any, 1920, 1080, 0);

      expect(boundsPadded.sequenceType).toBe('text');
      expect(boundsPadded.normX).toBe(0.5);
      expect(boundsPadded.normY).toBe(0.45);

      // Padded bounds must be strictly larger than zero padding
      expect(boundsPadded.normWidth).toBeGreaterThan(boundsZeroPad.normWidth);
      expect(boundsPadded.normHeight).toBeGreaterThan(boundsZeroPad.normHeight);

      // Must be within reasonable screen limits (not a blind 50% box)
      expect(boundsPadded.normWidth).toBeGreaterThan(0.2);
      expect(boundsPadded.normWidth).toBeLessThan(0.9);
      expect(boundsPadded.normHeight).toBeLessThan(0.3);
    });

    it('respects off-center positions such as YouTube Chapter (normY: 0.2) and Lower Third (normY: 0.82)', () => {
      const ytPreset = TYPOGRAPHY_PRESETS.find((p) => p.id === 'text_youtube_chapter')!;
      const lowerThirdPreset = TYPOGRAPHY_PRESETS.find((p) => p.id === 'text_lower_third_glass')!;

      const ytSeq = ytPreset.createSequence({ startFrame: 0, normX: 0.5, normY: 0.2 });
      const ltSeq = lowerThirdPreset.createSequence({ startFrame: 0, normX: 0.25, normY: 0.82 });

      const ytBounds = CanvasHitTester.resolveSequenceBounds(ytSeq as any, 1920, 1080, 8);
      const ltBounds = CanvasHitTester.resolveSequenceBounds(ltSeq as any, 1920, 1080, 8);

      expect(ytBounds.normY).toBe(0.2);
      expect(ltBounds.normY).toBe(0.82);
      expect(ltBounds.normX).toBe(0.25);
    });

    it('computes exact bounds for vector shapes based on width and height params', () => {
      const shapePreset = SHAPE_PRESETS[0];
      const seq = shapePreset.createSequence({ startFrame: 0, normX: 0.5, normY: 0.5 });

      const bounds = CanvasHitTester.resolveSequenceBounds(seq as any, 1920, 1080, 8);
      expect(bounds.sequenceType).toBe('shape');
      expect(bounds.normX).toBe(0.5);
      expect(bounds.normY).toBe(0.5);
      expect(bounds.normWidth).toBeGreaterThan(0);
      expect(bounds.normHeight).toBeGreaterThan(0);
    });

    it('resolves full-frame bounds for video media sequences', () => {
      const videoSeq = {
        id: 'video-main',
        type: 'video',
        time: { start: 0, duration: 300 },
        trackId: 'track-v1',
      };

      const bounds = CanvasHitTester.resolveSequenceBounds(videoSeq as any, 1920, 1080);
      expect(bounds.sequenceType).toBe('video');
      expect(bounds.normWidth).toBe(1.0);
      expect(bounds.normHeight).toBe(1.0);
      expect(bounds.normX).toBe(0.5);
      expect(bounds.normY).toBe(0.5);
    });
  });

  describe('TransformModifierPlugin & TextModifierPlugin Coordinate Centering', () => {
    it('anchors TransformModifierPlugin around normX and normY', () => {
      const plugin = new TransformModifierPlugin();
      const operations: string[] = [];

      const mockCtx = {
        translate: (x: number, y: number) => operations.push(`translate(${Math.round(x)},${Math.round(y)})`),
        rotate: (r: number) => operations.push(`rotate(${r})`),
        scale: (sx: number, sy: number) => operations.push(`scale(${sx},${sy})`),
        globalAlpha: 1,
      };

      const clipContext = {
        ctx: mockCtx,
        width: 1920,
        height: 1080,
        localFrame: 45,
        sequence: { durationFrames: 90 } as any,
      } as any;

      // Transform with off-center normX: 0.5, normY: 0.2 (Anchor should be 960, 216)
      plugin.renderClipSpace(clipContext, {
        normX: 0.5,
        normY: 0.2,
        x: 0,
        y: 0,
        scale: 1.2,
        rotation: 0,
      });

      // Translates to anchor (960, 216), scales, then translates back (-960, -216)
      expect(operations).toContain('translate(960,216)');
      expect(operations).toContain('scale(1.2,1.2)');
      expect(operations).toContain('translate(-960,-216)');
    });

    it('ensures TextModifierPlugin always translates to normX and normY in clip space', () => {
      const plugin = new TextModifierPlugin();
      const operations: string[] = [];

      const mockCtx = {
        save: () => {},
        restore: () => {},
        translate: (x: number, y: number) => operations.push(`translate(${Math.round(x)},${Math.round(y)})`),
        fillText: () => {},
        strokeText: () => {},
        measureText: (text: string) => ({ width: text.length * 15, actualBoundingBoxAscent: 15, actualBoundingBoxDescent: 5 }),
      } as any;

      const clipContext = {
        ctx: mockCtx,
        width: 1920,
        height: 1080,
        frame: 0,
        localFrame: 45,
        sequence: {
          id: 'test-text',
          type: 'overlay',
          modifiers: [{ type: 'transform', params: { normX: 0.5, normY: 0.8 } }],
        } as any,
      };

      plugin.renderClipSpace(clipContext, {
        text: 'LOWER THIRD TITLE',
        normX: 0.5,
        normY: 0.8,
        fontSize: 32,
      });

      // Canvas clip space must translate to (960, 864) = (0.5 * 1920, 0.8 * 1080)
      expect(operations).toContain('translate(960,864)');
    });

    it('inherits normX and normY from transform modifier when omitted on text/draw (Typography Preset contract)', () => {
      const plugin = new TextModifierPlugin();
      const operations: string[] = [];

      const mockCtx = {
        save: () => {},
        restore: () => {},
        translate: (x: number, y: number) => operations.push(`translate(${Math.round(x)},${Math.round(y)})`),
        fillText: () => {},
        strokeText: () => {},
        measureText: (text: string) => ({ width: text.length * 15, actualBoundingBoxAscent: 15, actualBoundingBoxDescent: 5 }),
      } as any;

      const clipContext = {
        ctx: mockCtx,
        width: 1920,
        height: 1080,
        frame: 0,
        localFrame: 45,
        sequence: {
          id: 'test-text-preset',
          type: 'overlay',
          modifiers: [{ type: 'transform', params: { normX: 0.5, normY: 0.45 } }],
        } as any,
      };

      // Notice params has NO normX or normY (exactly like TYPOGRAPHY_PRESETS)
      plugin.renderClipSpace(clipContext, {
        text: '24K GOLD EPIC TITLE',
        fontSize: 56,
      });

      // Canvas clip space must translate to (960, 486) = (0.5 * 1920, 0.45 * 1080), NEVER defaulting blindly to (960, 540)
      expect(operations).toContain('translate(960,486)');
    });

    it('anchors TransformModifierPlugin around child text/draw normX and normY when omitted on transform', () => {
      const plugin = new TransformModifierPlugin();
      const operations: string[] = [];

      const mockCtx = {
        translate: (x: number, y: number) => operations.push(`translate(${Math.round(x)},${Math.round(y)})`),
        rotate: (r: number) => operations.push(`rotate(${r})`),
        scale: (sx: number, sy: number) => operations.push(`scale(${sx},${sy})`),
        globalAlpha: 1,
      };

      const clipContext = {
        ctx: mockCtx,
        width: 1920,
        height: 1080,
        localFrame: 45,
        sequence: {
          durationFrames: 90,
          modifiers: [
            { type: 'transform', params: { scale: 1.0, rotation: 0 } },
            { type: 'text/draw', params: { text: 'Sub-Header', normX: 0.3, normY: 0.25 } },
          ],
        } as any,
      } as any;

      plugin.renderClipSpace(clipContext, {
        x: 0,
        y: 0,
        scale: 1.0,
        rotation: 0,
      });

      // Anchor must be (0.3 * 1920, 0.25 * 1080) = (576, 270)
      expect(operations).toContain('translate(576,270)');
      expect(operations).toContain('translate(-576,-270)');
    });

    it('anchors and rotates TransformModifierPlugin around custom anchorPoint pivot (e.g. top-left [0, 0]) instead of center', () => {
      const plugin = new TransformModifierPlugin();
      const operations: string[] = [];

      const mockCtx = {
        translate: (x: number, y: number) => operations.push(`translate(${Math.round(x)},${Math.round(y)})`),
        rotate: (r: number) => operations.push(`rotate(${r})`),
        scale: (sx: number, sy: number) => operations.push(`scale(${sx},${sy})`),
        globalAlpha: 1,
      };

      const clipContext = {
        ctx: mockCtx,
        width: 1920,
        height: 1080,
        localFrame: 45,
        sequence: {
          durationFrames: 90,
          modifiers: [
            { type: 'transform', params: { normX: 0.5, normY: 0.5, normWidth: 0.2, normHeight: 0.1, anchorPoint: [0.0, 0.0], rotation: 45 } },
          ],
        } as any,
      } as any;

      plugin.renderClipSpace(clipContext, {
        normX: 0.5,
        normY: 0.5,
        normWidth: 0.2,
        normHeight: 0.1,
        anchorPoint: [0.0, 0.0],
        rotation: 45,
        scale: 1.0,
      });

      // Pivot: X = 1920 * (0.5 - 0.5 * 0.2) = 1920 * 0.4 = 768
      // Pivot: Y = 1080 * (0.5 - 0.5 * 0.1) = 1080 * 0.45 = 486
      expect(operations).toContain('translate(768,486)');
      expect(operations).toContain('translate(-768,-486)');
    });
  });

  describe('Gizmo2DTransformation Pro NLE Interactions', () => {
    it('scales uniformly on corner handles when lockAspectRatio is true', () => {
      const startBox: BoundingBox2D = {
        x: 0.5,
        y: 0.5,
        width: 0.3,
        height: 0.15,
        rotation: 0,
      };

      const startPointer = { x: 0.65, y: 0.575 };
      const currentPointer = { x: 0.70, y: 0.625 };

      const res = Gizmo2DTransformation.computeDragTransform(
        startBox,
        'br', // Bottom-Right corner handle
        currentPointer,
        startPointer,
        true, // Lock aspect ratio (Default Pro NLE mode)
        false
      );

      // Width and height ratio must be preserved
      const initialAspect = startBox.width / startBox.height;
      const finalAspect = res.box.width / res.box.height;
      expect(Math.abs(initialAspect - finalAspect)).toBeLessThan(0.01);
    });

    it('stretches 1D single axis on edge handles', () => {
      const startBox: BoundingBox2D = {
        x: 0.5,
        y: 0.5,
        width: 0.3,
        height: 0.15,
        rotation: 0,
      };

      const startPointer = { x: 0.65, y: 0.5 };
      const currentPointer = { x: 0.75, y: 0.5 }; // Horizontal stretch to the right

      const res = Gizmo2DTransformation.computeDragTransform(
        startBox,
        'mr', // Middle-Right edge handle
        currentPointer,
        startPointer,
        false, // Directional stretch
        false
      );

      // Width expanded, height preserved
      expect(res.box.width).toBeGreaterThan(startBox.width);
      expect(res.box.height).toBe(startBox.height);
    });

    it('snaps rotation magnetically to 15-degree increments', () => {
      const startBox: BoundingBox2D = {
        x: 0.5,
        y: 0.5,
        width: 0.3,
        height: 0.15,
        rotation: 0,
      };

      // Pointer moved near 45 degrees (~44 degrees)
      const rad44 = (44 * Math.PI) / 180;
      const startPointer = { x: 0.5, y: 0.3 };
      const currentPointer = { x: 0.5 + Math.sin(rad44) * 0.2, y: 0.5 - Math.cos(rad44) * 0.2 };

      const res = Gizmo2DTransformation.computeDragTransform(
        startBox,
        'rotate',
        currentPointer,
        startPointer,
        false,
        false // Snapping enabled
      );

      // Must snap to exactly 45.0 degrees
      expect(res.box.rotation).toBe(45);
    });
  });
});
