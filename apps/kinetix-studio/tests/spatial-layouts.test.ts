import { describe, it, expect } from 'bun:test';
import {
  SPATIAL_LAYOUTS,
  LAYOUT_ENGINES,
  LEGACY_LAYOUT_MAP,
  resolveLegacyLayout,
  INITIAL_STUDIO_STATE,
  resolveLayoutGeometry,
  getSpatialSkeletonSpec,
  renderPosterComposition,
  computeChoreography,
  StudioState,
} from '../src/index';

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
  letterSpacing = '0px';

  callHistory: Array<{ method: string; args: unknown[] }> = [];

  save() { this.callHistory.push({ method: 'save', args: [] }); }
  restore() { this.callHistory.push({ method: 'restore', args: [] }); }
  beginPath() { this.callHistory.push({ method: 'beginPath', args: [] }); }
  closePath() { this.callHistory.push({ method: 'closePath', args: [] }); }
  moveTo(x: number, y: number) { this.callHistory.push({ method: 'moveTo', args: [x, y] }); }
  lineTo(x: number, y: number) { this.callHistory.push({ method: 'lineTo', args: [x, y] }); }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) { this.callHistory.push({ method: 'quadraticCurveTo', args: [cpx, cpy, x, y] }); }
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
    this.callHistory.push({ method: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] });
  }
  arc(x: number, y: number, r: number, s: number, e: number) { this.callHistory.push({ method: 'arc', args: [x, y, r, s, e] }); }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, s: number, e: number, ccw?: boolean) {
    this.callHistory.push({ method: 'ellipse', args: [x, y, rx, ry, rot, s, e, ccw] });
  }
  rect(x: number, y: number, w: number, h: number) { this.callHistory.push({ method: 'rect', args: [x, y, w, h] }); }
  roundRect(x: number, y: number, w: number, h: number, _r?: unknown) { this.callHistory.push({ method: 'roundRect', args: [x, y, w, h] }); }
  fill() { this.callHistory.push({ method: 'fill', args: [] }); }
  stroke() { this.callHistory.push({ method: 'stroke', args: [] }); }
  fillRect(x: number, y: number, w: number, h: number) { this.callHistory.push({ method: 'fillRect', args: [x, y, w, h] }); }
  strokeRect(x: number, y: number, w: number, h: number) { this.callHistory.push({ method: 'strokeRect', args: [x, y, w, h] }); }
  clearRect(x: number, y: number, w: number, h: number) { this.callHistory.push({ method: 'clearRect', args: [x, y, w, h] }); }
  fillText(text: string, x: number, y: number, maxWidth?: number) { this.callHistory.push({ method: 'fillText', args: [text, x, y, maxWidth] }); }
  strokeText(text: string, x: number, y: number, maxWidth?: number) { this.callHistory.push({ method: 'strokeText', args: [text, x, y, maxWidth] }); }
  measureText(text: string): TextMetrics {
    return {
      width: text.length * 8,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 8,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 2,
      alphabeticBaseline: 0,
      emHeightAscent: 10,
      emHeightDescent: 2,
      hangingBaseline: 8,
      ideographicBaseline: -2,
    } as unknown as TextMetrics;
  }
  translate(x: number, y: number) { this.callHistory.push({ method: 'translate', args: [x, y] }); }
  scale(x: number, y: number) { this.callHistory.push({ method: 'scale', args: [x, y] }); }
  rotate(angle: number) { this.callHistory.push({ method: 'rotate', args: [angle] }); }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.callHistory.push({ method: 'transform', args: [a, b, c, d, e, f] });
  }
  setLineDash(segments: number[]) { this.callHistory.push({ method: 'setLineDash', args: [segments] }); }
  clip() { this.callHistory.push({ method: 'clip', args: [] }); }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    return {
      addColorStop: () => {},
    } as unknown as CanvasGradient;
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient {
    return {
      addColorStop: () => {},
    } as unknown as CanvasGradient;
  }
}

describe('Option B: 6 Layout Engines & Sub-Style Variations Suite', () => {
  it('should define exactly 6 Layout Engines in LAYOUT_ENGINES', () => {
    const engines = Object.keys(LAYOUT_ENGINES);
    expect(engines.length).toBe(6);
    expect(engines).toContain('GridEngine');
    expect(engines).toContain('SplitEngine');
    expect(engines).toContain('StackTierEngine');
    expect(engines).toContain('FrameInsetEngine');
    expect(engines).toContain('LayeredStackEngine');
    expect(engines).toContain('TransformEngine');
  });

  it('should distribute exactly 17 primary sub-style variants across the 6 engines', () => {
    expect(LAYOUT_ENGINES.GridEngine.variants.length).toBe(3);
    expect(LAYOUT_ENGINES.SplitEngine.variants.length).toBe(2);
    expect(LAYOUT_ENGINES.StackTierEngine.variants.length).toBe(3);
    expect(LAYOUT_ENGINES.FrameInsetEngine.variants.length).toBe(3);
    expect(LAYOUT_ENGINES.LayeredStackEngine.variants.length).toBe(3);
    expect(LAYOUT_ENGINES.TransformEngine.variants.length).toBe(3);

    expect(SPATIAL_LAYOUTS.length).toBe(17);
  });

  it('should maintain deterministic backward compatibility mapping for all 45 legacy IDs', () => {
    const legacyKeys = Object.keys(LEGACY_LAYOUT_MAP);
    expect(legacyKeys.length).toBe(45);

    for (const legacyId of legacyKeys) {
      const resolved = resolveLegacyLayout(legacyId);
      expect(resolved).toBeDefined();
      expect(resolved.engine).toBeDefined();
      expect(resolved.variant).toBeDefined();
      expect(LAYOUT_ENGINES[resolved.engine]).toBeDefined();
    }
  });

  it('should resolve valid, finite mathematical geometry for all 17 variants in portrait 9:16', () => {
    const W = 344;
    const H = 612;
    const marginX = 24;
    const marginY = 24;
    const contentTopY = marginY + 30;
    const footerY = H - marginY;
    const usableH = footerY - contentTopY;

    for (const layout of SPATIAL_LAYOUTS) {
      const geom = resolveLayoutGeometry({
        engine: layout.engine,
        variant: layout.variantId,
        width: W,
        height: H,
        scaleFactor: 1,
        marginX,
        marginY,
        contentTopY,
        footerY,
        usableH,
        topHeadlineFlow: true,
        isLandscape: false,
      });

      // Assert non-NaN, positive bounds
      expect(Number.isFinite(geom.stageW)).toBe(true);
      expect(geom.stageW).toBeGreaterThan(0);
      expect(Number.isFinite(geom.stageH)).toBe(true);
      expect(geom.stageH).toBeGreaterThan(0);
      expect(Number.isFinite(geom.stageX)).toBe(true);
      expect(Number.isFinite(geom.stageY)).toBe(true);

      // Bounds containment
      expect(geom.stageX).toBeGreaterThanOrEqual(-1);
      expect(geom.stageX + geom.stageW).toBeLessThanOrEqual(W + 5);

      // Typography geometry
      expect(Number.isFinite(geom.typeW)).toBe(true);
      expect(geom.typeW).toBeGreaterThan(0);
      expect(Number.isFinite(geom.typeX)).toBe(true);
      expect(Number.isFinite(geom.typeY)).toBe(true);
      expect(geom.typeScale).toBeGreaterThan(0);

      // Badge Text
      expect(geom.badgeText.length).toBeGreaterThan(0);
    }
  });

  it('should resolve valid geometry across all 4 target aspect ratios', () => {
    const aspectRatios = [
      { name: '9:16 Portrait', W: 344, H: 612, isLandscape: false },
      { name: '4:5 IG Feed', W: 344, H: 430, isLandscape: false },
      { name: '1:1 Square', W: 344, H: 344, isLandscape: false },
      { name: '16:9 Landscape', W: 612, H: 344, isLandscape: true },
    ];

    for (const aspect of aspectRatios) {
      const marginX = 24;
      const marginY = 24;
      const contentTopY = marginY + 30;
      const footerY = aspect.H - marginY;
      const usableH = footerY - contentTopY;

      for (const layout of SPATIAL_LAYOUTS) {
        const geom = resolveLayoutGeometry({
          engine: layout.engine,
          variant: layout.variantId,
          width: aspect.W,
          height: aspect.H,
          scaleFactor: 1,
          marginX,
          marginY,
          contentTopY,
          footerY,
          usableH,
          topHeadlineFlow: true,
          isLandscape: aspect.isLandscape,
        });

        expect(Number.isFinite(geom.stageW)).toBe(true);
        expect(geom.stageW).toBeGreaterThan(0);
        expect(Number.isFinite(geom.stageH)).toBe(true);
        expect(geom.stageH).toBeGreaterThan(0);
        expect(geom.stageX + geom.stageW).toBeLessThanOrEqual(aspect.W + 10);
      }
    }
  });

  it('should render all variants via renderPosterComposition without throws or NaN coordinates', () => {
    const mockCtx = new MockCanvasRenderingContext2D();
    const choreo = computeChoreography(0, 120);

    for (const layout of SPATIAL_LAYOUTS) {
      mockCtx.callHistory = [];
      const testState: StudioState = {
        ...INITIAL_STUDIO_STATE,
        layoutEngine: layout.engine,
        layoutVariant: layout.variantId || 'default',
        layoutId: layout.id,
      };

      expect(() => {
        renderPosterComposition(mockCtx as unknown as CanvasRenderingContext2D, {
          width: 344,
          height: 612,
          state: testState,
          frame: 0,
          totalFrames: 120,
          choreo,
          scale: 1,
        });
      }).not.toThrow();

      // Verify canvas operations took place
      expect(mockCtx.callHistory.length).toBeGreaterThan(15);

      // Verify no NaN values leaked into canvas calls
      for (const call of mockCtx.callHistory) {
        for (const arg of call.args) {
          if (typeof arg === 'number') {
            expect(Number.isNaN(arg)).toBe(false);
          }
        }
      }
    }
  });

  it('should ensure getSpatialSkeletonSpec exports matched specs for all variants', () => {
    for (const layout of SPATIAL_LAYOUTS) {
      const testState: StudioState = {
        ...INITIAL_STUDIO_STATE,
        layoutEngine: layout.engine,
        layoutVariant: layout.variantId || 'default',
        layoutId: layout.id,
      };
      const spec = getSpatialSkeletonSpec(testState);
      expect(spec.badgeText).toBeTruthy();
      expect(spec.heroStageClass).toBeTruthy();
      expect(spec.engine).toBe(layout.engine);
    }
  });
});
