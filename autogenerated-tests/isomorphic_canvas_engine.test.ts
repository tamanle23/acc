import { describe, it, expect } from 'bun:test';
import { IRPreviewEngine } from '../packages/ir/src/renderer/preview/IRPreviewEngine';
import { CanvasTransformOverlay } from '../packages/effect-engines/src/canvas/CanvasTransformOverlay';
import { HologramHUDPlugin } from '../packages/ir/src/plugins/overlay/HologramHUDPlugin';
import { PartialVFXPlugin } from '../packages/ir/src/plugins/vfx/PartialVFXPlugin';
import { CanvasParticleOverlayPlugin } from '../packages/ir/src/plugins/overlay/CanvasParticleOverlayPlugin';
import { createCanvas } from '@napi-rs/canvas';
import type { ResolvedTimeline, ResolvedTrack } from '../packages/ir/src/types/VideoIR';

function createMockTimeline(): ResolvedTimeline {
  const track1: ResolvedTrack = {
    id: 'track-v1',
    name: 'Video 1',
    type: 'visual',
    order: 1,
    sequences: [
      {
        id: 'seq-1',
        name: 'Hero Sequence',
        type: 'video',
        startFrame: 0,
        durationFrames: 60,
        endFrame: 60,
        timelineStartFrame: 0,
        modifiers: [
          {
            type: 'transform',
            params: { scale: 1.5, x: 50, y: -20, ease: 'power2.inOut' },
          },
        ],
      },
      {
        id: 'seq-2',
        name: 'Second Sequence',
        type: 'video',
        startFrame: 60,
        durationFrames: 90,
        endFrame: 150,
        timelineStartFrame: 60,
        modifiers: [],
      },
    ],
  };

  const tracksMap = new Map<string, ResolvedTrack>();
  tracksMap.set(track1.id, track1);

  const sequencesMap = new Map();
  for (const seq of track1.sequences) {
    sequencesMap.set(seq.id, seq);
  }

  return {
    id: 'timeline-test-1',
    totalFrames: 150,
    meta: {
      globalFps: 30,
      canvasSize: { w: 1920, h: 1080 },
    },
    tracks: tracksMap,
    sequences: sequencesMap,
    modifiers: [],
  };
}

describe('Phase 2: Isomorphic IRPreviewEngine & CanvasTransformOverlay Suite', () => {
  it('should initialize IRPreviewEngine and seek/render frames deterministically', () => {
    const timeline = createMockTimeline();
    const engine = new IRPreviewEngine(timeline);
    expect(engine).toBeDefined();

    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d') as any;

    const res0 = engine.renderFrame(0, ctx);
    expect(res0.frame).toBe(0);
    expect(res0.activeSequences.length).toBe(1);
    expect(res0.activeSequences[0].id).toBe('seq-1');

    const res65 = engine.renderFrame(65, ctx);
    expect(res65.frame).toBe(65);
    expect(res65.activeSequences.length).toBe(1);
    expect(res65.activeSequences[0].id).toBe('seq-2');
  });

  it('should evaluate deterministic interpolated motion transform without drifting', () => {
    const timeline = createMockTimeline();
    const engine = new IRPreviewEngine(timeline);
    const seq = timeline.sequences.get('seq-1')!;

    const transform0 = engine.getActiveInterpolatedTransform(seq, 0);
    expect(transform0).toBeDefined();
    expect(transform0.opacity).toBeCloseTo(0, 1);

    const transform30 = engine.getActiveInterpolatedTransform(seq, 30);
    expect(transform30).toBeDefined();
    expect(transform30.opacity).toBeCloseTo(1, 1);
    expect(transform30.scale).toBeCloseTo(1.5, 1);
  });

  it('should render HologramHUDPlugin procedural cybernetic telemetry to canvas context', () => {
    const plugin = new HologramHUDPlugin();
    expect(plugin.type).toBe('overlay/hologram_hud');

    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext('2d') as any;

    expect(() => {
      plugin.renderClipSpace(
        {
          canvas,
          ctx,
          frame: 30,
          width: 1280,
          height: 720,
          sequence: { id: 'seq-hud', startFrame: 0, durationFrames: 60 } as any,
          transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        },
        { ringRadius: 0.35, scanlineDensity: 40, color: '#00ffff' }
      );
    }).not.toThrow();

    const buffer = canvas.toBuffer('image/png');
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should render PartialVFXPlugin regions (spotlight, blur, glitch, point_emitter)', () => {
    const plugin = new PartialVFXPlugin();
    expect(plugin.type).toBe('vfx/partial');

    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d') as any;

    expect(() => {
      plugin.renderClipSpace(
        {
          canvas,
          ctx,
          frame: 15,
          width: 1920,
          height: 1080,
          sequence: { id: 'seq-vfx', startFrame: 0, durationFrames: 60 } as any,
          transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        },
        { type: 'spotlight', intensity: 1.5, radius: 200, color: '#00d4ff' }
      );
      plugin.renderClipSpace(
        {
          canvas,
          ctx,
          frame: 15,
          width: 1920,
          height: 1080,
          sequence: { id: 'seq-vfx', startFrame: 0, durationFrames: 60 } as any,
          transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        },
        { type: 'digital_glitch', intensity: 1.0 }
      );
    }).not.toThrow();
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
