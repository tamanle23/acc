import { describe, it, expect, beforeEach } from 'bun:test';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { MoveSequenceCommand } from '../apps/studio/src/lib/commands/MoveSequenceCommand';

describe('MoveSequenceCommand & IRStateManager Sequence Moving Suite', () => {
  const manager = IRStateManager.getInstance();

  beforeEach(async () => {
    await manager.switchTemplate('default');
  });

  it('moves sequence along time on the same track with undo/redo support', () => {
    const initialState = manager.getState();
    const track = initialState.doc.tracks[0];
    const seq = track.sequences[0];
    const seqId = seq.id;
    const initialStart = typeof seq.time.start === 'number' ? seq.time.start : (seq.time.start as any)?.offsetFrames ?? 0;

    const targetFrame = initialStart + 45;
    manager.moveSequence(seqId, track.id, targetFrame);

    const movedState = manager.getState();
    const movedSeq = movedState.doc.tracks[0].sequences.find((s) => s.id === seqId);
    expect(movedSeq).toBeDefined();
    const currentStart = typeof movedSeq!.time.start === 'number' ? movedSeq!.time.start : (movedSeq!.time.start as any)?.offsetFrames;
    expect(currentStart).toBe(targetFrame);
    expect(manager.canUndo()).toBe(true);

    // Undo
    manager.undo();
    const undoneState = manager.getState();
    const restoredSeq = undoneState.doc.tracks[0].sequences.find((s) => s.id === seqId);
    const restoredStart = typeof restoredSeq!.time.start === 'number' ? restoredSeq!.time.start : (restoredSeq!.time.start as any)?.offsetFrames;
    expect(restoredStart).toBe(initialStart);

    // Redo
    manager.redo();
    const redoneState = manager.getState();
    const redoneSeq = redoneState.doc.tracks[0].sequences.find((s) => s.id === seqId);
    const redoneStart = typeof redoneSeq!.time.start === 'number' ? redoneSeq!.time.start : (redoneSeq!.time.start as any)?.offsetFrames;
    expect(redoneStart).toBe(targetFrame);
  });

  it('moves sequence across tracks with complete lane transfer and rollback', () => {
    const initialState = manager.getState();
    expect(initialState.doc.tracks.length).toBeGreaterThanOrEqual(2);

    const sourceTrack = initialState.doc.tracks[0];
    const targetTrack = initialState.doc.tracks[1];
    const seqToMove = sourceTrack.sequences[0];
    const seqId = seqToMove.id;

    // Move to target track at frame 60
    manager.moveSequence(seqId, targetTrack.id, 60);

    const stateAfterMove = manager.getState();
    const oldTrackSeq = stateAfterMove.doc.tracks[0].sequences.find((s) => s.id === seqId);
    const newTrackSeq = stateAfterMove.doc.tracks[1].sequences.find((s) => s.id === seqId);

    expect(oldTrackSeq).toBeUndefined();
    expect(newTrackSeq).toBeDefined();
    expect(newTrackSeq!.id).toBe(seqId);

    // Undo restores to source track
    manager.undo();
    const stateAfterUndo = manager.getState();
    const restoredInSource = stateAfterUndo.doc.tracks[0].sequences.find((s) => s.id === seqId);
    const absentInTarget = stateAfterUndo.doc.tracks[1].sequences.find((s) => s.id === seqId);

    expect(restoredInSource).toBeDefined();
    expect(absentInTarget).toBeUndefined();
  });

  it('merges consecutive move commands for the same sequence', () => {
    const initialState = manager.getState();
    const track = initialState.doc.tracks[0];
    const seq = track.sequences[0];
    const seqId = seq.id;

    const cmd1 = new MoveSequenceCommand(seqId, track.id, 20);
    const cmd2 = new MoveSequenceCommand(seqId, track.id, 40);

    const merged = cmd1.tryMerge(cmd2);
    expect(merged).toBe(true);

    const executed = cmd1.execute(initialState.doc);
    const movedSeq = executed.tracks[0].sequences.find((s) => s.id === seqId);
    expect(movedSeq?.time.start).toBe(40);
  });
});
