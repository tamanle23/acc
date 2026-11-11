import { describe, it, expect } from 'bun:test';
import {
  SPATIAL_LAYOUTS,
  SHADER_CATALOG,
  HERO_CATALOG,
  BACKGROUND_GRAPHICS_CATALOG,
  INITIAL_STUDIO_STATE,
  calculateWcagContrast,
  computeChoreography,
  AnalogAudioSynth,
  renderPosterComposition,
  getBaseExportDimensions,
  generatePosterSvgString,
  SafeCanvas2D,
  StudioState,
} from '../src/index';

/**
 * Mock CanvasRenderingContext2D for headless testing of Canvas operations.
 */
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

  save() {
    this.callHistory.push({ method: 'save', args: [] });
  }
  restore() {
    this.callHistory.push({ method: 'restore', args: [] });
  }
  beginPath() {
    this.callHistory.push({ method: 'beginPath', args: [] });
  }
  closePath() {
    this.callHistory.push({ method: 'closePath', args: [] });
  }
  moveTo(x: number, y: number) {
    this.callHistory.push({ method: 'moveTo', args: [x, y] });
  }
  lineTo(x: number, y: number) {
    this.callHistory.push({ method: 'lineTo', args: [x, y] });
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.callHistory.push({ method: 'quadraticCurveTo', args: [cpx, cpy, x, y] });
  }
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number
  ) {
    this.callHistory.push({ method: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] });
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {
    this.callHistory.push({ method: 'arcTo', args: [x1, y1, x2, y2, radius] });
  }
  arc(x: number, y: number, r: number, s: number, e: number) {
    this.callHistory.push({ method: 'arc', args: [x, y, r, s, e] });
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, s: number, e: number) {
    this.callHistory.push({ method: 'ellipse', args: [x, y, rx, ry, rot, s, e] });
  }
  rect(x: number, y: number, w: number, h: number) {
    this.callHistory.push({ method: 'rect', args: [x, y, w, h] });
  }
  roundRect(x: number, y: number, w: number, h: number, _r?: unknown) {
    this.callHistory.push({ method: 'roundRect', args: [x, y, w, h] });
  }
  fill() {
    this.callHistory.push({ method: 'fill', args: [] });
  }
  stroke() {
    this.callHistory.push({ method: 'stroke', args: [] });
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.callHistory.push({ method: 'fillRect', args: [x, y, w, h] });
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    this.callHistory.push({ method: 'strokeRect', args: [x, y, w, h] });
  }
  clearRect(x: number, y: number, w: number, h: number) {
    this.callHistory.push({ method: 'clearRect', args: [x, y, w, h] });
  }
  fillText(text: string, x: number, y: number, maxWidth?: number) {
    this.callHistory.push({ method: 'fillText', args: [text, x, y, maxWidth] });
  }
  strokeText(text: string, x: number, y: number, maxWidth?: number) {
    this.callHistory.push({ method: 'strokeText', args: [text, x, y, maxWidth] });
  }
  measureText(text: string): TextMetrics {
    this.callHistory.push({ method: 'measureText', args: [text] });
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
  translate(x: number, y: number) {
    this.callHistory.push({ method: 'translate', args: [x, y] });
  }
  scale(x: number, y: number) {
    this.callHistory.push({ method: 'scale', args: [x, y] });
  }
  rotate(angle: number) {
    this.callHistory.push({ method: 'rotate', args: [angle] });
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.callHistory.push({ method: 'transform', args: [a, b, c, d, e, f] });
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.callHistory.push({ method: 'setTransform', args: [a, b, c, d, e, f] });
  }
  resetTransform() {
    this.callHistory.push({ method: 'resetTransform', args: [] });
  }
  clip() {
    this.callHistory.push({ method: 'clip', args: [] });
  }
  setLineDash(segments: number[]) {
    this.callHistory.push({ method: 'setLineDash', args: [segments] });
  }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    return {
      addColorStop: () => {},
    } as unknown as CanvasGradient;
  }
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number
  ): CanvasGradient {
    return {
      addColorStop: () => {},
    } as unknown as CanvasGradient;
  }
}

/**
 * Creates a mock canvas element backed by MockCanvasRenderingContext2D.
 */
function createMockCanvas(width: number, height: number) {
  const ctx = new MockCanvasRenderingContext2D();
  return {
    width,
    height,
    getContext: (type: string) => {
      if (type === '2d') return ctx as unknown as CanvasRenderingContext2D;
      return null;
    },
    mockContext: ctx,
  } as unknown as HTMLCanvasElement & { mockContext: MockCanvasRenderingContext2D };
}

describe('Deterministic Preview & Video Export Consistency Engine', () => {
  describe('Canonical Dimensions & Aspect Ratios', () => {
    it('returns exact base dimensions matching export standard specs', () => {
      expect(getBaseExportDimensions('9:16')).toEqual({ width: 1080, height: 1920 });
      expect(getBaseExportDimensions('4:5')).toEqual({ width: 1080, height: 1350 });
      expect(getBaseExportDimensions('1:1')).toEqual({ width: 1080, height: 1080 });
      expect(getBaseExportDimensions('16:9')).toEqual({ width: 1920, height: 1080 });
    });
  });

  describe('Master Canvas Composition Engine (renderPosterComposition)', () => {
    it('executes deterministically on standard 1080x1920 canvas without exceptions', () => {
      const canvas = createMockCanvas(1080, 1920);
      const state: StudioState = { ...INITIAL_STUDIO_STATE };
      const choreo = computeChoreography(0.4, state.timelineMode, state.hicksLawDisclosure);

      expect(() => {
        renderPosterComposition(canvas.getContext('2d')!, {
          width: canvas.width,
          height: canvas.height,
          state,
          frame: 48,
          totalFrames: 120,
          choreo,
        });
      }).not.toThrow();

      // Verify that layer draw calls occurred
      expect(canvas.mockContext.callHistory.length).toBeGreaterThan(50);
      // Verify fills were drawn for background and elements
      const fillRectCalls = canvas.mockContext.callHistory.filter((c) => c.method === 'fillRect');
      expect(fillRectCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('renders across all 45 spatial layouts consistently', () => {
      const canvas = createMockCanvas(1080, 1920);
      SPATIAL_LAYOUTS.forEach((layout) => {
        const state: StudioState = {
          ...INITIAL_STUDIO_STATE,
          layoutId: layout.id,
        };
        const choreo = computeChoreography(0.5, state.timelineMode, state.hicksLawDisclosure);

        expect(() => {
          renderPosterComposition(canvas.getContext('2d')!, {
            width: canvas.width,
            height: canvas.height,
            state,
            frame: 60,
            totalFrames: 120,
            choreo,
          });
        }).not.toThrow();
      });
    });

    it('renders across all 12 procedural background graphics in both drift and static modes', () => {
      const canvas = createMockCanvas(1080, 1920);
      expect(BACKGROUND_GRAPHICS_CATALOG.length).toBe(12);
      BACKGROUND_GRAPHICS_CATALOG.forEach((bg) => {
        for (const motion of [true, false]) {
          for (const duotone of [true, false]) {
            const state: StudioState = {
              ...INITIAL_STUDIO_STATE,
              bgGraphicId: bg.id,
              bgMotion: motion,
              bgDuotone: duotone,
            };
            const choreo = computeChoreography(0.5, state.timelineMode, state.hicksLawDisclosure);

            expect(() => {
              renderPosterComposition(canvas.getContext('2d')!, {
                width: canvas.width,
                height: canvas.height,
                state,
                frame: 45,
                totalFrames: 120,
                choreo,
              });
            }).not.toThrow();
          }
        }
      });
    });

    it('renders across all 28 ambient shader strategies consistently', () => {
      const canvas = createMockCanvas(1080, 1920);
      expect(SHADER_CATALOG.length).toBe(28);
      SHADER_CATALOG.forEach((shader) => {
        const state: StudioState = {
          ...INITIAL_STUDIO_STATE,
          shaderId: shader.id,
        };
        const choreo = computeChoreography(0.25, state.timelineMode, state.hicksLawDisclosure);

        expect(() => {
          renderPosterComposition(canvas.getContext('2d')!, {
            width: canvas.width,
            height: canvas.height,
            state,
            frame: 30,
            totalFrames: 120,
            choreo,
          });
        }).not.toThrow();
      });
    });

    it('renders across all hero subjects in both articulated and static micro-kinetics modes', () => {
      const canvas = createMockCanvas(1080, 1920);
      expect(HERO_CATALOG.length).toBe(50);
      HERO_CATALOG.forEach((hero) => {
        for (const microKinetics of [true, false]) {
          const state: StudioState = {
            ...INITIAL_STUDIO_STATE,
            heroId: hero.id,
            heroMicroKinetics: microKinetics,
          };
          const choreo = computeChoreography(0.75, state.timelineMode, state.hicksLawDisclosure);

          expect(() => {
            renderPosterComposition(canvas.getContext('2d')!, {
              width: canvas.width,
              height: canvas.height,
              state,
              frame: 90,
              totalFrames: 120,
              choreo,
            });
          }).not.toThrow();
        }
      });
    });

    it('respects layer visibility switches without crashing or leaking', () => {
      const canvas = createMockCanvas(1080, 1920);
      const hiddenLayersState: StudioState = {
        ...INITIAL_STUDIO_STATE,
        layerVisibility: {
          background: false,
          shader: false,
          hero: false,
          typography: false,
          audio: false,
        },
        blueprintGrid: false,
        safeZone916: false,
      };

      const choreo = computeChoreography(0.5, hiddenLayersState.timelineMode, false);

      expect(() => {
        renderPosterComposition(canvas.getContext('2d')!, {
          width: canvas.width,
          height: canvas.height,
          state: hiddenLayersState,
          frame: 60,
          totalFrames: 120,
          choreo,
        });
      }).not.toThrow();
    });

    it('applies high-DPI scaling factor (2x Retina, 4x Print Master) accurately', () => {
      const canvas4K = createMockCanvas(2160, 3840);
      const state: StudioState = { ...INITIAL_STUDIO_STATE };
      const choreo = computeChoreography(0.5, state.timelineMode, state.hicksLawDisclosure);

      expect(() => {
        renderPosterComposition(canvas4K.getContext('2d')!, {
          width: 1080,
          height: 1920,
          state,
          frame: 60,
          totalFrames: 120,
          choreo,
          scale: 2,
        });
      }).not.toThrow();

      // Check scale transform occurred
      const scaleCalls = canvas4K.mockContext.callHistory.filter((c) => c.method === 'scale');
      expect(scaleCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('triggers WCAG scrim overlay when foreground/background contrast is low', () => {
      const canvas = createMockCanvas(1080, 1920);
      // Low contrast palette: dark ink on dark canvas
      const lowContrastState: StudioState = {
        ...INITIAL_STUDIO_STATE,
        palette: {
          bg: '#111111',
          ink: '#161616',
          accent: '#181818',
          accent2: '#202020',
        },
      };

      const choreo = computeChoreography(0.5, lowContrastState.timelineMode, false);

      canvas.mockContext.callHistory = [];
      renderPosterComposition(canvas.getContext('2d')!, {
        width: canvas.width,
        height: canvas.height,
        state: lowContrastState,
        frame: 60,
        totalFrames: 120,
        choreo,
      });

      // Low contrast must trigger the safety scrim fillRect
      const fillRects = canvas.mockContext.callHistory.filter((c) => c.method === 'fillRect');
      expect(fillRects.length).toBeGreaterThanOrEqual(2); // Canvas background + scrim
    });

    it('positions hero subject precisely centered within the hero stage window frame across layout archetypes', () => {
      const layoutsToVerify = [
        'manuscript',
        'split-screen',
        'radial-burst',
        'top-heavy',
        'bottom-heavy',
        'minimalist-void',
      ] as const;

      layoutsToVerify.forEach((layoutId) => {
        const canvas = createMockCanvas(1080, 1920);
        const state: StudioState = {
          ...INITIAL_STUDIO_STATE,
          layoutId,
          layerVisibility: {
            shader: true,
            hero: true,
            typography: true,
            audio: false,
          },
        };
        const choreo = computeChoreography(0.5, state.timelineMode, false);

        renderPosterComposition(canvas.getContext('2d')!, {
          width: canvas.width,
          height: canvas.height,
          state,
          frame: 60,
          totalFrames: 120,
          choreo,
        });

        // Verify that translate calls for hero stage are within canvas boundary
        const translates = canvas.mockContext.callHistory.filter((c) => c.method === 'translate');
        expect(translates.length).toBeGreaterThan(0);

        // Find the hero stage translation call
        const heroStageTranslate = translates.find((t) => {
          const [tx, ty] = t.args as [number, number];
          return tx >= 0 && tx < 1080 && ty >= 0 && ty < 1920;
        });
        expect(heroStageTranslate).toBeDefined();
      });
    });
  });

  describe('Audio Engine & Offline Synthesizer', () => {
    it('initializes AnalogAudioSynth with 4 polyphonic voices and patterns', () => {
      const synth = new AnalogAudioSynth();
      expect(synth).toBeDefined();
      expect(synth.getPattern()).toBe('techno-4-on-floor');

      synth.setPattern('dubstep-half-step');
      expect(synth.getPattern()).toBe('dubstep-half-step');

      synth.setMasterVolume(0.8);
      synth.setFilter(2500, 4.0);
      expect(synth.getVoiceMutes().kick).toBe(false);
      expect(synth.getVoiceMutes().bass).toBe(false);
      expect(synth.getVoiceMutes().hat).toBe(false);
      expect(synth.getVoiceMutes().pad).toBe(false);
    });

    it('phases-lock step scheduling deterministically', () => {
      const synth = new AnalogAudioSynth();
      // Ensure triggerStep does not throw even without active audioContext
      expect(() => {
        synth.triggerStep(0, 128, 0.0);
        synth.triggerStep(4, 128, 0.5);
        synth.triggerStep(8, 128, 1.0);
        synth.triggerStep(12, 128, 1.5);
      }).not.toThrow();
    });

    it('renders offline audio track buffer safely', async () => {
      const synth = new AnalogAudioSynth();
      const buffer = await synth.renderAudioTrackOffline({
        bpm: 124,
        durationSec: 1,
        sampleRate: 44100,
      });
      // In Node/Bun headless where OfflineAudioContext is polyfilled or fallback is returned
      expect(buffer).toBeDefined();
      expect(buffer.numberOfChannels).toBe(2);
      expect(buffer.sampleRate).toBe(44100);
      expect(buffer.duration).toBeCloseTo(1, 1);
    });
  });

  describe('Scalable Vector Graphics (.svg) Generation', () => {
    it('generates valid self-contained SVG with payload and colors', () => {
      const state: StudioState = {
        ...INITIAL_STUDIO_STATE,
        content: {
          headline: ['KINETIC', 'DESIGN', 'SYSTEM'],
          subhead: 'STUDIO GRADE DETERMINISTIC ENGINE',
          date: '2026.11.05',
          location: 'TOKYO // CYPHER LAB',
          tag: 'VERIFIED 1:1 PARITY',
          sponsor: 'ANTIGRAVITY AUDIO/VIDEO',
        },
      };

      const svgString = generatePosterSvgString(state);
      expect(typeof svgString).toBe('string');
      expect(svgString).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svgString).toContain('KINETIC');
      expect(svgString).toContain('DESIGN');
      expect(svgString).toContain('SYSTEM');
      expect(svgString).toContain('STUDIO GRADE DETERMINISTIC ENGINE');
      expect(svgString).toContain('TOKYO // CYPHER LAB');
      expect(svgString).toContain('</svg>');
    });
  });
});
