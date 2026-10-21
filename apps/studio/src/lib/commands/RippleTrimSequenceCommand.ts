import type { ICommand } from './ICommand';
import type { VideoIRDocument } from '@acc/ir';

/**
 * RippleTrimSequenceCommand:
 * Trims a target sequence and ripples (shifts) all subsequent downstream
 * sequences on the same track by the trimmed delta frames, keeping timing synchronized
 * without leaving gaps or creating overlaps.
 */
export class RippleTrimSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private deltaStart: number;
  private deltaDuration: number;

  constructor(sequenceId: string, deltaStart: number, deltaDuration: number) {
    this.id = `ripple_trim_${sequenceId}_${Date.now()}`;
    this.description = `Ripple trim sequence ${sequenceId} (${deltaStart}f, ${deltaDuration}f)`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.deltaStart = deltaStart;
    this.deltaDuration = deltaDuration;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    return this.applyRipple(doc, this.deltaStart, this.deltaDuration);
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    return this.applyRipple(doc, -this.deltaStart, -this.deltaDuration);
  }

  public tryMerge(next: ICommand): boolean {
    if (next instanceof RippleTrimSequenceCommand && next.sequenceId === this.sequenceId) {
      this.deltaStart += next.deltaStart;
      this.deltaDuration += next.deltaDuration;
      return true;
    }
    return false;
  }

  private applyRipple(doc: VideoIRDocument, dStart: number, dDur: number): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      const targetIdx = track.sequences.findIndex((s) => s.id === this.sequenceId);
      if (targetIdx === -1) continue;

      const targetSeq = track.sequences[targetIdx];
      const targetStartBefore = typeof targetSeq.time.start === 'number' ? targetSeq.time.start : 0;

      // 1. Mutate target sequence
      if (typeof targetSeq.time.start === 'number') {
        targetSeq.time.start = Math.max(0, targetSeq.time.start + dStart);
      } else if (targetSeq.time.start && typeof targetSeq.time.start === 'object') {
        const currentOffset = targetSeq.time.start.offsetFrames ?? 0;
        targetSeq.time.start.offsetFrames = currentOffset + dStart;
      }

      if (typeof targetSeq.time.duration === 'number') {
        targetSeq.time.duration = Math.max(1, targetSeq.time.duration + dDur);
      } else if (targetSeq.time.duration && typeof targetSeq.time.duration === 'object') {
        const currentPad = targetSeq.time.duration.paddingFrames ?? 0;
        targetSeq.time.duration.paddingFrames = currentPad + dDur;
      }

      // Total net shift for downstream clips on this track
      // If we trimmed the end (dStart === 0, dDur !== 0), downstream clips shift by dDur.
      // If we trimmed the start (dStart !== 0, dDur === -dStart), duration changed and start moved, downstream clips shift by (dStart + dDur).
      const downstreamShift = dStart + dDur;

      if (downstreamShift !== 0) {
        // Shift all subsequent sequences on the same track that start after this sequence
        for (let i = 0; i < track.sequences.length; i++) {
          if (i === targetIdx) continue;
          const otherSeq = track.sequences[i];
          if (typeof otherSeq.time.start === 'number' && otherSeq.time.start >= targetStartBefore) {
            otherSeq.time.start = Math.max(0, otherSeq.time.start + downstreamShift);
          } else if (otherSeq.time.start && typeof otherSeq.time.start === 'object') {
            const curOffset = otherSeq.time.start.offsetFrames ?? 0;
            otherSeq.time.start.offsetFrames = curOffset + downstreamShift;
          }
        }
      }

      return copy;
    }

    return copy;
  }
}
