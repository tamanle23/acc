import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  SafeZoneManager,
  BoundedAcousticCaptionStrategy,
  ColorGradingEngine,
  DeterministicParticleField,
  Depth3DFactory,
  IsomorphicEasing,
  drawCanvasCaptionsFromSnapshot,
  TrackingCalloutEngine,
} from '../packages/effect-engines/src';
import {
  HeuristicDepthStrategy,
  GrabCutFallbackStrategy,
} from '../packages/effect-engines/src/vision';
import type { ICanvasContext2D, ICanvasInstance, IImageData } from '@acc/core-isomorphic';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native/canvas/NapiCanvasAdapter';

describe('Effect Engines - Pure Isomorphic WinterTC (ECMA-429) Suite', () => {
  beforeEach(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
  });

  it('IsomorphicEasing provides closed-form mathematical curve precision', () => {
    // power2Out
    expect(IsomorphicEasing.power2Out(0)).toBe(0);
    expect(IsomorphicEasing.power2Out(1)).toBe(1);
    expect(IsomorphicEasing.power2Out(0.5)).toBe(0.75);

    // power2In
    expect(IsomorphicEasing.power2In(0)).toBe(0);
    expect(IsomorphicEasing.power2In(1)).toBe(1);
    expect(IsomorphicEasing.power2In(0.5)).toBe(0.25);

    // sineInOut
    expect(IsomorphicEasing.sineInOut(0)).toBe(0);
    expect(IsomorphicEasing.sineInOut(1)).toBe(1);
    expect(Math.abs(IsomorphicEasing.sineInOut(0.5) - 0.5)).toBeLessThan(1e-6);

    // expoInOut
    expect(IsomorphicEasing.expoInOut(0)).toBe(0);
    expect(IsomorphicEasing.expoInOut(1)).toBe(1);
    expect(IsomorphicEasing.expoInOut(0.5)).toBe(0.5);
  });

  it('SafeZoneManager calculates margins without DOM/window globals', () => {
    const tiktok = SafeZoneManager.getMargins('tiktok');
    expect(tiktok.topMarginPx).toBe(120);
    expect(tiktok.bottomMarginPx).toBe(220);

    const reels = SafeZoneManager.getMargins('reels');
    expect(reels.topMarginPx).toBe(100);
    expect(reels.bottomMarginPx).toBe(200);

    const inSafe = SafeZoneManager.isBoxInSafeZone(
      { x: 100, y: 300, width: 200, height: 100 },
      'tiktok',
      1080,
      1920
    );
    expect(inSafe).toBe(true);
  });

  it('BoundedAcousticCaptionStrategy evaluates subtitle timeline accurately', () => {
    const strategy = new BoundedAcousticCaptionStrategy();
    const captions = [
      { start: 0.0, end: 1.0, text: 'Isomorphic' },
      { start: 1.1, end: 2.0, text: 'WinterTC' },
    ];

    const snapshot = strategy.evaluate(captions, 0.5);
    expect(snapshot.shouldRender).toBe(true);
    expect(snapshot.phrase).toBeDefined();
    expect(snapshot.phrase?.[0].text).toBe('Isomorphic');

    const grouped = strategy.groupPhrases(captions, 2);
    expect(grouped.length).toBe(1);
    expect(grouped[0].length).toBe(2);
  });

  it('renders subtitles and tracking callouts against ICanvasContext2D without error', () => {
    const commands: string[] = [];
    const mockCtx = {
      save: () => commands.push('save'),
      restore: () => commands.push('restore'),
      beginPath: () => commands.push('beginPath'),
      closePath: () => commands.push('closePath'),
      arc: () => commands.push('arc'),
      fill: () => commands.push('fill'),
      stroke: () => commands.push('stroke'),
      moveTo: () => commands.push('moveTo'),
      lineTo: () => commands.push('lineTo'),
      fillText: () => commands.push('fillText'),
      strokeText: () => commands.push('strokeText'),
      measureText: (t: string) => ({ width: t.length * 10 }),
      roundRect: () => commands.push('roundRect'),
      setLineDash: () => {},
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textBaseline: 'middle',
    } as unknown as ICanvasContext2D;

    // Callout
    TrackingCalloutEngine.renderTrackingCallout(mockCtx, {
      labelText: 'Focal Point',
      targetPoint: { x: 100, y: 100 },
      boxOffset: { x: 50, y: -50 },
    });
    expect(commands).toContain('save');
    expect(commands).toContain('restore');
    expect(commands).toContain('fillText');

    // Subtitles
    const snapshot = {
      shouldRender: true,
      phrase: [{ start: 0, end: 1, text: 'Hello' }],
      activeWordIndex: 0,
      activeWordProgress: 0.5,
    };
    drawCanvasCaptionsFromSnapshot(mockCtx, snapshot, undefined, 1920, 1080);
    expect(commands.filter((c) => c === 'fillText').length).toBeGreaterThan(1);
  });

  it('ColorGradingEngine applies CSS filter string on ICanvasContext2D', () => {
    const engine = new ColorGradingEngine();
    const mockCtx: any = { filter: 'none' };

    engine.applyCanvasTransform(mockCtx as ICanvasContext2D, {
      contrast: 1.2,
      saturation: 1.1,
      exposure: 0.1,
    });

    expect(mockCtx.filter).toContain('contrast(120%)');
    expect(mockCtx.filter).toContain('saturate(110%)');
    expect(mockCtx.filter).toContain('brightness(110%)');
  });

  it('HeuristicDepthStrategy and GrabCutFallbackStrategy operate strictly with Uint8Array', async () => {
    const dummyPixels = new Uint8Array(64 * 64 * 4);
    for (let i = 0; i < dummyPixels.length; i += 4) {
      dummyPixels[i] = 120;     // R
      dummyPixels[i + 1] = 120; // G
      dummyPixels[i + 2] = 120; // B
      dummyPixels[i + 3] = 255; // A
    }

    const canvas = UniversalCanvasProvider.createCanvas(64, 64);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#787878';
    ctx.fillRect(0, 0, 64, 64);

    const input = {
      data: dummyPixels,
      canvas,
      width: 64,
      height: 64,
    };

    const depthStrat = new HeuristicDepthStrategy();
    const depthRes = await depthStrat.estimateDepth(input);
    expect(depthRes).toBeDefined();
    expect(depthRes.depth16Data).toBeInstanceOf(Uint16Array);
    expect(depthRes.depth16Buffer).toBeInstanceOf(Uint8Array);
    expect(depthRes.width).toBe(64);
    expect(depthRes.height).toBe(64);

    const segStrat = new GrabCutFallbackStrategy();
    const segRes = await segStrat.segment(input);
    expect(segRes).toBeDefined();
    expect(segRes.maskAlphaData).toBeInstanceOf(Uint8Array);
    expect(segRes.maskRgbaBuffer).toBeInstanceOf(Uint8Array);
    expect(segRes.maskAlphaBuffer).toBeInstanceOf(Uint8Array);
    expect(segRes.boundingBox).toBeDefined();
  });
});
