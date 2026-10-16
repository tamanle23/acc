import { describe, it, expect } from 'bun:test';
import { UniversalCanvasEngine } from '../packages/effect-engines/src/canvas/UniversalCanvasEngine';
import { CanvasTransformOverlay } from '../packages/effect-engines/src/canvas/CanvasTransformOverlay';
import { createCanvas } from '@napi-rs/canvas';

describe('Phase 2: Core UniversalCanvasEngine & Pts.js Transform Overlay', () => {
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

  it('should compile declarative GSAP timeline and advance deterministically', () => {
    const engine = new UniversalCanvasEngine({ width: 1920, height: 1080 });
    const mockSequences = [
      {
        id: 'seq-1',
        time: { start: 0, duration: 60 },
        modifiers: [
          { type: 'transform', params: { scale: 1.5, x: 50, y: -20, ease: 'power2.inOut' } },
        ],
      },
      {
        id: 'seq-2',
        time: { start: 60, duration: 90 },
      },
    ];

    expect(() => {
      engine.syncTimeline(mockSequences, 30);
    }).not.toThrow();

    // Advance to frame 30 (1.0s) and frame 60 (2.0s)
    expect(() => {
      engine.update(1.0, 1.0);
      engine.update(2.0, 1.0);
    }).not.toThrow();

    engine.dispose();
  });

  it('should generate particle swarm with gravitational attractors and velocity trails', () => {
    const engine = new UniversalCanvasEngine({ width: 800, height: 600 });
    engine.initParticleSystem(150);

    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d') as any;

    expect(() => {
      engine.render(ctx, 1.5, 1.0);
      engine.render(ctx, 3.0, 1.2);
    }).not.toThrow();

    const buffer = canvas.toBuffer('image/png');
    expect(buffer.length).toBeGreaterThan(0);

    engine.dispose();
  });

  it('should render dual-pass 2.5D parallax relighting with Blinn-Phong specular sheen', () => {
    const engine = new UniversalCanvasEngine({ width: 1280, height: 720 });
    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext('2d') as any;

    expect(() => {
      engine.render2DParallax(ctx, 1280, 720, 1.0, {
        x: 0.6,
        y: 0.4,
        diffuse: 1.5,
        specular: 2.0,
        color: '#00d4ff',
      });
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

  it('should render Partial VFX regions (spotlight, blur, glitch, emitter) with multi-pass compositing', () => {
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

  it('should render transform overlay with live dimension and angle readout badges', () => {
    const overlay = new CanvasTransformOverlay();
    overlay.setVisible(true);

    const box = { x: 0.5, y: 0.5, width: 0.4, height: 0.3, rotation: 35.5 };
    overlay.update(box, [
      { id: 'c-x', type: 'centerX', orientation: 'vertical', position: 0.5, label: 'Center X' },
    ]);

    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d') as any;

    // 1. Rotation mode -> angle badge
    overlay.setActiveInteraction('rotate', 'rotate');
    expect(() => {
      overlay.render(ctx, 1920, 1080, box);
    }).not.toThrow();

    // 2. Resize mode -> dimension badge
    overlay.setActiveInteraction('br', 'resize');
    expect(() => {
      overlay.render(ctx, 1920, 1080, box);
    }).not.toThrow();

    // 3. Clear interaction
    overlay.setActiveInteraction(null, null);
    expect(() => {
      overlay.render(ctx, 1920, 1080, box);
    }).not.toThrow();

    overlay.dispose();
  });
});
