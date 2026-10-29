import { describe, it, expect } from 'bun:test';
import type { VideoIRDocument } from '../packages/ir/src/types/VideoIR';
import { SplitSequenceCommand } from '../apps/studio/src/lib/commands/SplitSequenceCommand';
import { RippleMoveSequenceCommand } from '../apps/studio/src/lib/commands/RippleMoveSequenceCommand';

describe('Relational Timing Commands & Timing Materialization Suite', () => {
  function createRelationalDoc(): VideoIRDocument {
    return {
      version: '1.0.0',
      meta: {
        title: 'Relational Timing Test',
        globalFps: 30,
      },
      tracks: [
        {
          id: 'track-v1',
          name: 'Video 1',
          type: 'video',
          sequences: [
            {
              id: 'seq-master',
              name: 'Master Clip',
              type: 'video',
              time: { start: 0, duration: 120 },
            },
            {
              id: 'seq-relational',
              name: 'Dependent Clip',
              type: 'video',
              time: {
                start: { after: 'seq-master', offsetFrames: 10 } as any,
                duration: '300f' as any,
              },
            },
          ],
        },
      ],
    };
  }

  it('SplitSequenceCommand materializes relational start and duration into absolute numbers', () => {
    const doc = createRelationalDoc();
    // Split seq-relational at frame 160 (which is 30 frames into its duration: start 130, dur 300)
    const splitCmd = new SplitSequenceCommand('seq-relational', 160, 130, 430);
    const updatedDoc = splitCmd.execute(doc);

    const track = updatedDoc.tracks[0];
    expect(track.sequences.length).toBe(3);

    const firstHalf = track.sequences.find((s) => s.id === 'seq-relational');
    expect(firstHalf).toBeDefined();
    // start must be absolute number 130
    expect(typeof firstHalf?.time.start).toBe('number');
    expect(firstHalf?.time.start).toBe(130);
    // duration must be 160 - 130 = 30
    expect(typeof firstHalf?.time.duration).toBe('number');
    expect(firstHalf?.time.duration).toBe(30);

    const secondHalf = track.sequences.find((s) => s.id.startsWith('seq-relational_split_'));
    expect(secondHalf).toBeDefined();
    // start must be absolute number 160
    expect(typeof secondHalf?.time.start).toBe('number');
    expect(secondHalf?.time.start).toBe(160);
    // duration must be 430 - 160 = 270
    expect(typeof secondHalf?.time.duration).toBe('number');
    expect(secondHalf?.time.duration).toBe(270);

    // Verify undo restores original state
    const restoredDoc = splitCmd.undo(updatedDoc);
    const restoredTrack = restoredDoc.tracks[0];
    expect(restoredTrack.sequences.length).toBe(2);
    expect(restoredTrack.sequences.some((s) => s.id.startsWith('seq-relational_split_'))).toBe(false);
  });

  it('RippleMoveSequenceCommand materializes target start & strips dangling relational expressions', () => {
    const doc = createRelationalDoc();
    // Move seq-relational to frame 200 on same track
    const moveCmd = new RippleMoveSequenceCommand('seq-relational', 'track-v1', 200, 130, 300);
    const updatedDoc = moveCmd.execute(doc);

    const track = updatedDoc.tracks[0];
    const movedSeq = track.sequences.find((s) => s.id === 'seq-relational');
    expect(movedSeq).toBeDefined();

    // Start must be materialized to concrete number 200
    expect(typeof movedSeq?.time.start).toBe('number');
    expect(movedSeq?.time.start).toBe(200);

    // Duration must be materialized to concrete number 300
    expect(typeof movedSeq?.time.duration).toBe('number');
    expect(movedSeq?.time.duration).toBe(300);

    // Relational reference after seq-master must be stripped
    expect(typeof movedSeq?.time.start).not.toBe('object');
  });
});
