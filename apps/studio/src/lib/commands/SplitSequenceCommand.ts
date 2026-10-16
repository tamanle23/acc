import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence } from '@acc/ir/client';

export class SplitSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private splitFrame: number;
  private originalSequenceSnapshot: IRSequence | null = null;
  private createdSequenceId: string | null = null;

  constructor(sequenceId: string, splitFrame: number, startFrame: number, endFrame: number) {
    this.id = `split_${sequenceId}_${Date.now()}`;
    this.description = `Split sequence ${sequenceId} at frame ${splitFrame}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.splitFrame = splitFrame;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      const idx = track.sequences.findIndex((s) => s.id === this.sequenceId);
      if (idx !== -1) {
        const originalSeq = track.sequences[idx];
        if (!this.originalSequenceSnapshot) {
          this.originalSequenceSnapshot = JSON.parse(JSON.stringify(originalSeq));
        }

        const currentStart = typeof originalSeq.time.start === 'number' ? originalSeq.time.start : 0;
        const currentDur = typeof originalSeq.time.duration === 'number' ? originalSeq.time.duration : 90;
        const currentEnd = currentStart + currentDur;

        if (this.splitFrame <= currentStart || this.splitFrame >= currentEnd) {
          return copy;
        }

        const dur1 = this.splitFrame - currentStart;
        const dur2 = currentEnd - this.splitFrame;

        // Sequence 1 updated
        originalSeq.time = {
          start: currentStart,
          duration: dur1,
        };

        // Sequence 2 created
        const newSeqId = this.createdSequenceId || `${originalSeq.id}_split_${Date.now()}`;
        this.createdSequenceId = newSeqId;

        const newSeq: IRSequence = {
          ...JSON.parse(JSON.stringify(originalSeq)),
          id: newSeqId,
          time: {
            start: {
              after: originalSeq.id,
              offsetFrames: 0,
            },
            duration: dur2,
          },
        };

        track.sequences.splice(idx + 1, 0, newSeq);
        return copy;
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      const originalIdx = track.sequences.findIndex((s) => s.id === this.sequenceId);
      if (originalIdx !== -1 && this.originalSequenceSnapshot) {
        // Restore original snapshot
        track.sequences[originalIdx] = JSON.parse(JSON.stringify(this.originalSequenceSnapshot));

        // Remove the split part if exists
        if (this.createdSequenceId) {
          track.sequences = track.sequences.filter((s) => s.id !== this.createdSequenceId);
        }
        return copy;
      }
    }

    return copy;
  }

  public tryMerge(_next: ICommand): boolean {
    return false; // Splits are atomic, discrete actions
  }
}
