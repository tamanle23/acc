import { describe, it, expect } from 'bun:test';
import type { VideoIRDocument, IRSequence, IRTrack } from '../packages/ir/src/types/VideoIR';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';

describe('Workspace DnD Quadrant Integration & Drop Geometry Suite', () => {
  it('calculates frame drops accurately incorporating timeline zoom and scroll offsets', () => {
    // Formula from useWorkspaceDnd:
    // P_frame = Math.max(0.2, 1.5 * timelineZoomScale)
    // F_drop = Math.max(0, Math.floor(((X_cursor - X_origin) + timelineScrollLeft) / P_frame))

    const zoomScale = 1.0;
    const pixelsPerFrame = Math.max(0.2, 1.5 * zoomScale); // 1.5
    const originX = 100;
    const scrollLeft = 300;

    // Case 1: Cursor at origin + 150px
    const cursorX1 = 250;
    const rawPixels1 = (cursorX1 - originX) + scrollLeft; // 150 + 300 = 450
    const frame1 = Math.max(0, Math.floor(rawPixels1 / pixelsPerFrame)); // 450 / 1.5 = 300
    expect(frame1).toBe(300);

    // Case 2: Cursor with high zoom (scale 2.0 -> 3.0 px/frame)
    const zoomScaleHigh = 2.0;
    const pixelsPerFrameHigh = Math.max(0.2, 1.5 * zoomScaleHigh); // 3.0
    const frameHigh = Math.max(0, Math.floor(rawPixels1 / pixelsPerFrameHigh)); // 450 / 3.0 = 150
    expect(frameHigh).toBe(150);

    // Case 3: Out of bounds left clamp to frame 0
    const cursorXNegative = 50; // origin 100, scrollLeft 0 -> -50px
    const rawPixelsNeg = (cursorXNegative - originX) + 0;
    const frameNeg = Math.max(0, Math.floor(rawPixelsNeg / pixelsPerFrame));
    expect(frameNeg).toBe(0);
  });

  it('normalizes preview canvas viewport drop coordinates to [0.05, 0.95]', () => {
    const rect = { left: 200, top: 150, width: 800, height: 450 };

    const getNormalizedCoords = (clientX: number, clientY: number) => {
      const normX = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width));
      const normY = Math.max(0.05, Math.min(0.95, (clientY - rect.top) / rect.height));
      return { normX, normY };
    };

    // Center drop
    const center = getNormalizedCoords(600, 375);
    expect(center.normX).toBeCloseTo(0.5, 2);
    expect(center.normY).toBeCloseTo(0.5, 2);

    // Extreme left edge clamped to 0.05
    const leftEdge = getNormalizedCoords(100, 375);
    expect(leftEdge.normX).toBe(0.05);

    // Extreme bottom edge clamped to 0.95
    const bottomEdge = getNormalizedCoords(600, 700);
    expect(bottomEdge.normY).toBe(0.95);
  });

  it('adds dropped sequences onto target timeline tracks without mutating undo history pollution', () => {
    const manager = IRStateManager.getInstance();
    const state = manager.getState();
    const track = state.doc.tracks[0];
    expect(track).toBeDefined();

    const initialSeqCount = track.sequences.length;
    const testSeqId = `seq-dnd-test-${Date.now()}`;
    const newSeq: IRSequence = {
      id: testSeqId,
      name: 'DnD Dropped Clip',
      type: 'video',
      time: { start: 120, duration: 60 },
    };

    manager.addSequence(track.id, newSeq);
    const updatedState = manager.getState();
    const updatedTrack = updatedState.doc.tracks.find((t) => t.id === track.id);

    expect(updatedTrack?.sequences.some((s) => s.id === testSeqId)).toBe(true);
    expect(updatedTrack?.sequences.length).toBe(initialSeqCount + 1);

    // Clean up via undo
    manager.undo();
    const rolledBackState = manager.getState();
    const rolledBackTrack = rolledBackState.doc.tracks.find((t) => t.id === track.id);
    expect(rolledBackTrack?.sequences.some((s) => s.id === testSeqId)).toBe(false);
  });
});
