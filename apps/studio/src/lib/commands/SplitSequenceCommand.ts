import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence } from '../../../../../packages/ir/src/types/VideoIR';
import { VideoIRAuthoringEngine } from '../../../../../packages/ir/src/authoring/VideoIRAuthoringEngine';

export class SplitSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private splitFrame: number;
  private resolvedStartFrame: number;
  private resolvedEndFrame: number;
  private originalSequenceSnapshot: IRSequence | null = null;
  private createdSequenceId: string | null = null;
  private nextSequenceIndexSnapshot: number | undefined = undefined;

  constructor(sequenceId: string, splitFrame: number, startFrame?: number, endFrame?: number) {
    this.id = `split_${sequenceId}_${Date.now()}`;
    this.description = `Split sequence ${sequenceId} at frame ${splitFrame}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.splitFrame = splitFrame;
    this.resolvedStartFrame = typeof startFrame === 'number' ? startFrame : 0;
    this.resolvedEndFrame = typeof endFrame === 'number' ? endFrame : 90;
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
        if (this.nextSequenceIndexSnapshot === undefined) {
          this.nextSequenceIndexSnapshot = copy.meta?.nextSequenceIndex;
        }

        let currentStart: number;
        let currentDur: number;

        if (typeof originalSeq.time.start === 'number') {
          currentStart = originalSeq.time.start;
        } else {
          currentStart = this.resolvedStartFrame;
        }

        if (typeof originalSeq.time.duration === 'number') {
          currentDur = originalSeq.time.duration;
        } else if (typeof originalSeq.time.duration === 'string') {
          const parsed = parseInt(originalSeq.time.duration, 10);
          currentDur = !isNaN(parsed) && parsed > 0 ? parsed : Math.max(1, this.resolvedEndFrame - currentStart);
        } else {
          currentDur = Math.max(1, this.resolvedEndFrame - currentStart);
        }

        const currentEnd = currentStart + currentDur;

        if (this.splitFrame <= currentStart || this.splitFrame >= currentEnd) {
          return copy;
        }

        const dur1 = this.splitFrame - currentStart;
        const dur2 = currentEnd - this.splitFrame;

        // Sequence 1 updated (retains original sequence ID)
        originalSeq.time = {
          start: currentStart,
          duration: dur1,
        };

        // Sequence 2 created with deterministic sequential ID from VideoIRAuthoringEngine
        if (!this.createdSequenceId) {
          const splitResult = VideoIRAuthoringEngine.allocateSplitSequenceId(copy, originalSeq);
          this.createdSequenceId = splitResult.part2Id;
        }
        const newSeqId = this.createdSequenceId;

        const baseName = originalSeq.name || originalSeq.id;
        const newSeq: IRSequence = {
          ...JSON.parse(JSON.stringify(originalSeq)),
          id: newSeqId,
          name: `${baseName} (Part 2)`,
          time: {
            start: this.splitFrame,
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

        // Restore nextSequenceIndex if we had a snapshot
        if (copy.meta) {
          if (this.nextSequenceIndexSnapshot !== undefined) {
            copy.meta.nextSequenceIndex = this.nextSequenceIndexSnapshot;
          }
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
