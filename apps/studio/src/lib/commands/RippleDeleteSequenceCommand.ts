import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence } from '@acc/ir';

/**
 * RippleDeleteSequenceCommand:
 * Deletes a target sequence and ripples (shifts backward) all downstream
 * sequences on the same track by the deleted sequence's duration, closing the gap.
 * Fully undoable and redoable.
 */
export class RippleDeleteSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private deletedSequence: IRSequence | null = null;
  private trackId: string | null = null;
  private originalIndex: number = -1;
  private shiftFrames: number = 0;

  constructor(sequenceId: string) {
    this.id = `ripple_del_${sequenceId}_${Date.now()}`;
    this.description = `Ripple delete sequence ${sequenceId}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      const idx = track.sequences.findIndex((s) => s.id === this.sequenceId);
      if (idx >= 0) {
        this.trackId = track.id;
        this.originalIndex = idx;
        const targetSeq = track.sequences[idx];
        this.deletedSequence = JSON.parse(JSON.stringify(targetSeq));

        const targetStart = typeof targetSeq.time.start === 'number' ? targetSeq.time.start : 0;
        const targetDuration = typeof targetSeq.time.duration === 'number' ? targetSeq.time.duration : 0;
        this.shiftFrames = targetDuration;

        // Remove sequence
        track.sequences.splice(idx, 1);

        // Shift downstream sequences backward to close the gap
        if (this.shiftFrames > 0) {
          for (const remainingSeq of track.sequences) {
            if (typeof remainingSeq.time.start === 'number' && remainingSeq.time.start >= targetStart) {
              remainingSeq.time.start = Math.max(targetStart, remainingSeq.time.start - this.shiftFrames);
            } else if (remainingSeq.time.start && typeof remainingSeq.time.start === 'object') {
              const curOffset = remainingSeq.time.start.offsetFrames ?? 0;
              remainingSeq.time.start.offsetFrames = curOffset - this.shiftFrames;
            }
          }
        }

        return copy;
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.deletedSequence || !this.trackId) return doc;
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    const track = copy.tracks.find((t) => t.id === this.trackId);
    if (!track) return copy;

    const targetStart = typeof this.deletedSequence.time.start === 'number' ? this.deletedSequence.time.start : 0;

    // First shift downstream sequences forward to recreate the space
    if (this.shiftFrames > 0) {
      for (const existingSeq of track.sequences) {
        if (typeof existingSeq.time.start === 'number' && existingSeq.time.start >= targetStart) {
          existingSeq.time.start += this.shiftFrames;
        } else if (existingSeq.time.start && typeof existingSeq.time.start === 'object') {
          const curOffset = existingSeq.time.start.offsetFrames ?? 0;
          existingSeq.time.start.offsetFrames = curOffset + this.shiftFrames;
        }
      }
    }

    // Re-insert deleted sequence at its original index
    if (this.originalIndex >= 0 && this.originalIndex <= track.sequences.length) {
      track.sequences.splice(this.originalIndex, 0, JSON.parse(JSON.stringify(this.deletedSequence)));
    } else {
      track.sequences.push(JSON.parse(JSON.stringify(this.deletedSequence)));
    }

    return copy;
  }
}
