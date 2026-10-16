import { describe, it, expect } from 'bun:test';
import { UniversalCanvasEngine } from '../packages/effect-engines/src/canvas/UniversalCanvasEngine';
import { createCanvas } from '@napi-rs/canvas';

describe('Phase 1 & 2: Shared Isomorphic Canvas Engine (UniversalCanvasEngine, GSAP & pts.js)', () => {
  it('should initialize UniversalCanvasEngine and resize dimensions cleanly', () => {
    const engine = new UniversalCanvasEngine({ width: 1280, height: 720 });
    expect(engine.width).toBe(1280);
    expect(engine.height).toBe(720);
    expect(engine.overlay).toBeDefined();

    engine.resize(1920, 1080);
    expect(engine.width).toBe(1920);
    expect(engine.height).toBe(1080);
    engine.dispose();
  });

  it('should generate particle system and render deterministically to @napi-rs/canvas', () => {
    const engine = new UniversalCanvasEngine({ width: 800, height: 600 });
    engine.initParticleSystem(100);

    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d') as any;

    expect(() => {
      engine.render(ctx, 1.5, 1.0);
    }).not.toThrow();

    const buffer = canvas.toBuffer('image/png');
    expect(buffer.length).toBeGreaterThan(0);

    engine.dispose();
  });

  it('should initialize holographic HUD and render to @napi-rs/canvas cleanly', () => {
    const engine = new UniversalCanvasEngine({ width: 1280, height: 720 });
    engine.initHologramHUD(0.35, 40);

    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext('2d') as any;

    expect(() => {
      engine.render(ctx, 2.0, 1.2);
    }).not.toThrow();

    engine.dispose();
  });

  it('should render Partial VFX regions (spotlight, blur, glitch, emitter) without errors', () => {
    const engine = new UniversalCanvasEngine({ width: 1920, height: 1080 });
    engine.setPartialVFXRegions([
      { id: 'vfx-1', type: 'spotlight', x: 0.5, y: 0.5, radius: 200, color: '#00d4ff', intensity: 1.5 },
      { id: 'vfx-2', type: 'glitch', x: 0.3, y: 0.4, width: 0.2, height: 0.1, intensity: 1.0 },
      { id: 'vfx-3', type: 'blur', x: 0.7, y: 0.7, width: 0.3, height: 0.2 },
      { id: 'vfx-4', type: 'point_emitter', x: 0.5, y: 0.3, color: '#ec4899' },
    ]);

    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d') as any;

    expect(() => {
      engine.render(ctx, 0.5, 1.0);
    }).not.toThrow();

    engine.dispose();
  });

  it('should render transform overlay and magnetic guides cleanly', () => {
    const engine = new UniversalCanvasEngine({ width: 1920, height: 1080 });
    engine.setOverlayVisible(true);
    engine.updateOverlay(
      { x: 0.5, y: 0.5, width: 0.4, height: 0.3, rotation: 15 },
      [{ id: 'c-x', type: 'centerX', orientation: 'vertical', position: 0.5, label: 'Center X' }]
    );

    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d') as any;

    expect(() => {
      engine.render(ctx, 0, 1.0);
    }).not.toThrow();

    engine.dispose();
  });
});
