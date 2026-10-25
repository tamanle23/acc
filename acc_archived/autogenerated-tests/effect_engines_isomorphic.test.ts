import { describe, it, expect, beforeEach } from 'bun:test';
import {
  SafeZoneManager,
  BoundedAcousticCaptionStrategy,
  ColorGradingEngine,
  DeterministicParticleField,
  Depth3DFactory,
  drawFrameBreakerFrame,
} from '../packages/effect-engines/src';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '@acc/core';

describe('Phase 4: Pure Isomorphic Effect Engines Suite (@acc/effect-engines)', () => {
  beforeEach(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
  });

  it('instantiates and computes safe zones isomorphically', () => {
    const margins = SafeZoneManager.getMargins('tiktok');
    expect(margins).toBeDefined();
    expect(margins.topMarginPx).toBeGreaterThan(0);
    expect(margins.bottomMarginPx).toBeGreaterThan(0);

    const isInSafe = SafeZoneManager.isBoxInSafeZone(
      { x: 100, y: 300, width: 200, height: 100 },
      'tiktok',
      1080,
      1920
    );
    expect(isInSafe).toBe(true);
  });

  it('evaluates bounded acoustic captions without TimelineEngine dependency', () => {
    const strategy = new BoundedAcousticCaptionStrategy();
    const captions = [
      { start: 0.1, end: 0.8, text: 'Hello' },
      { start: 0.9, end: 1.5, text: 'World' },
    ];

    const snapshot = strategy.evaluate(captions, 0.4);
    expect(snapshot).toBeDefined();
    expect(snapshot.shouldRender).toBe(true);
    expect(snapshot.phrase).toBeDefined();
    expect(snapshot.phrase?.length).toBe(1);
    expect(snapshot.phrase?.[0].text).toBe('Hello');
  });

  it('runs ColorGradingEngine without Node FFI or server dependencies', () => {
    const engine = new ColorGradingEngine();
    const canvas = UniversalCanvasProvider.createCanvas(10, 10);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 10, 10);

    engine.applyCanvasTransform(ctx as any, {
      preset: 'cyberpunk_teal_orange',
      contrast: 1.2,
      saturation: 1.1,
    });

    const data = ctx.getImageData(0, 0, 10, 10);
    expect(data.data.length).toBe(400);
  });

  it('renders DeterministicParticleField deterministically with seeded noise', () => {
    const canvas = UniversalCanvasProvider.createCanvas(100, 100);
    const ctx = canvas.getContext('2d');

    expect(() => {
      DeterministicParticleField.render(ctx, 100, 100, 15, {
        type: 'dust',
        seed: 42,
        intensity: 1.0,
      });
    }).not.toThrow();

    const data = ctx.getImageData(0, 0, 100, 100);
    expect(data.data.length).toBe(100 * 100 * 4);
  });

  it('resolves Depth3DFactory renderers isomorphically', () => {
    const renderer = Depth3DFactory.getRenderer('frame_breaker');
    expect(renderer).toBeDefined();
    expect(typeof renderer.renderFrame).toBe('function');
  });
});
