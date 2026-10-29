import { describe, it, expect } from 'bun:test';
import { IRPreviewEngine } from '../apps/studio/src/renderer/IRPreviewEngine';
import type { ResolvedTimeline } from '../packages/ir/src/types/VideoIR';

describe('Viewport Gizmo Projection & Ephemeral Transform Suite', () => {
  it('projects canvas coordinates into normalized percentages accurately', () => {
    const canvasW = 1920;
    const canvasH = 1080;

    // Case 1: Centered clip (muX = 0.5, muY = 0.5, offset = 0, 0)
    const muX1 = 0.5;
    const muY1 = 0.5;
    const offsetX1 = 0;
    const offsetY1 = 0;
    const percentX1 = (muX1 + (offsetX1 / canvasW)) * 100;
    const percentY1 = (muY1 + (offsetY1 / canvasH)) * 100;

    expect(percentX1).toBe(50);
    expect(percentY1).toBe(50);

    // Case 2: Offset by +480px X (1/4 canvas) and -270px Y (1/4 canvas)
    const offsetX2 = 480;
    const offsetY2 = -270;
    const percentX2 = (muX1 + (offsetX2 / canvasW)) * 100;
    const percentY2 = (muY1 + (offsetY2 / canvasH)) * 100;

    expect(percentX2).toBe(75);
    expect(percentY2).toBe(25);
  });

  it('normalizes container pointer deltas accurately irrespective of viewport element scale', () => {
    // When preview viewport element is scaled down (e.g. width = 960, height = 540)
    const containerW = 960;
    const containerH = 540;
    const canvasW = 1920;
    const canvasH = 1080;

    // Drag pointer by 48px horizontally in container
    const deltaX = 48;
    const deltaNormX = deltaX / containerW; // 48 / 960 = 0.05
    const canvasDeltaX = Math.round(deltaNormX * canvasW); // 0.05 * 1920 = 96px

    expect(deltaNormX).toBe(0.05);
    expect(canvasDeltaX).toBe(96);
  });

  it('IRPreviewEngine manages ephemeral transform overrides with live merging during drag', () => {
    const mockTimeline: ResolvedTimeline = {
      meta: { globalFps: 30, canvasSize: { w: 1920, h: 1080 } },
      totalFrames: 120,
      tracks: new Map(),
      sequences: new Map([
        [
          'seq-test',
          {
            id: 'seq-test',
            startFrame: 0,
            durationFrames: 60,
            endFrame: 60,
            modifiers: [
              {
                type: 'transform',
                params: { x: 100, y: 50, scale: 1.0, rotation: 0, opacity: 1.0 },
              },
            ],
          } as any,
        ],
      ]),
    };

    const engine = new IRPreviewEngine(mockTimeline);
    const seq = mockTimeline.sequences.get('seq-test')!;

    // Baseline interpolated transform without override
    const base = engine.getActiveInterpolatedTransform(seq, 0);
    expect(base.x).toBe(100);
    expect(base.y).toBe(50);

    // Apply live ephemeral override during drag
    engine.setEphemeralTransformOverride('seq-test', {
      x: 250,
      y: 120,
      scaleX: 1.5,
      scaleY: 1.5,
    });

    const activeWithOverride = engine.getActiveInterpolatedTransform(seq, 0);
    expect(activeWithOverride.x).toBe(250);
    expect(activeWithOverride.y).toBe(120);
    expect(activeWithOverride.scaleX).toBe(1.5);

    // Clear ephemeral override on drag end
    engine.setEphemeralTransformOverride('seq-test', null);
    const restored = engine.getActiveInterpolatedTransform(seq, 0);
    expect(restored.x).toBe(100);
    expect(restored.y).toBe(50);
  });
});
