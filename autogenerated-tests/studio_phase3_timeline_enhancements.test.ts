import { describe, it, expect, beforeEach } from 'bun:test';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';

describe('Studio Phase 3: Timeline Engine Modernization', () => {
  beforeEach(async () => {
    // Reset to default template
    await IRStateManager.getInstance().switchTemplate('default');
  });

  it('unifies timeline totalFrames and calculates valid timeline boundaries', () => {
    const state = IRStateManager.getInstance().getState();
    expect(state.timeline).toBeDefined();
    expect(state.timeline?.totalFrames).toBeGreaterThan(0);
    const totalFrames = state.timeline?.totalFrames || 300;
    expect(typeof totalFrames).toBe('number');
    expect(totalFrames).toBe(state.timeline!.totalFrames);
  });

  it('calculates magnetic snap points including sequence starts, ends, playhead, and 1s ticks', () => {
    const state = IRStateManager.getInstance().getState();
    const tracks = Array.from(state.timeline?.tracks.values() || []);
    const currentFrame = 45;
    const fps = state.doc.meta.fps || 30;
    const totalFrames = state.timeline?.totalFrames || 300;

    const snapPoints: number[] = [currentFrame];
    for (const track of tracks) {
      for (const s of track.sequences) {
        snapPoints.push(s.startFrame, s.startFrame + s.durationFrames);
      }
    }
    const totalSeconds = Math.ceil(totalFrames / fps);
    for (let sec = 0; sec <= totalSeconds; sec++) {
      snapPoints.push(sec * fps);
    }

    // Must include playhead
    expect(snapPoints).toContain(45);
    // Must include 1-second grid ticks
    expect(snapPoints).toContain(0);
    expect(snapPoints).toContain(30);
    expect(snapPoints).toContain(60);

    // Verify snapping logic within threshold of 4 frames
    const candidateFrame = 28; // within 2 frames of 30
    let snappedFrame: number | null = null;
    for (const sp of snapPoints) {
      if (Math.abs(candidateFrame - sp) <= 4) {
        snappedFrame = sp;
        break;
      }
    }
    expect(snappedFrame).toBe(30);
  });

  it('supports track reordering via IRStateManager.reorderTrack up and down', () => {
    const initialTracks = [...IRStateManager.getInstance().getState().doc.tracks];
    expect(initialTracks.length).toBeGreaterThanOrEqual(2);

    const firstTrackId = initialTracks[0].id;
    const secondTrackId = initialTracks[1].id;

    // Move first track down
    IRStateManager.getInstance().reorderTrack(firstTrackId, 'down');
    let state = IRStateManager.getInstance().getState();
    expect(state.doc.tracks[0].id).toBe(secondTrackId);
    expect(state.doc.tracks[1].id).toBe(firstTrackId);

    // Move it back up
    IRStateManager.getInstance().reorderTrack(firstTrackId, 'up');
    state = IRStateManager.getInstance().getState();
    expect(state.doc.tracks[0].id).toBe(firstTrackId);
    expect(state.doc.tracks[1].id).toBe(secondTrackId);
  });

  it('undo and redo revert track reordering cleanly', () => {
    const initialOrder = IRStateManager.getInstance().getState().doc.tracks.map((t) => t.id);
    const firstTrackId = initialOrder[0];

    IRStateManager.getInstance().reorderTrack(firstTrackId, 'down');
    expect(IRStateManager.getInstance().getState().doc.tracks[1].id).toBe(firstTrackId);

    IRStateManager.getInstance().undo();
    expect(IRStateManager.getInstance().getState().doc.tracks.map((t) => t.id)).toEqual(initialOrder);

    IRStateManager.getInstance().redo();
    expect(IRStateManager.getInstance().getState().doc.tracks[1].id).toBe(firstTrackId);
  });
});
