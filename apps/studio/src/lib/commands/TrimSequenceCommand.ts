import type { ICommand } from './ICommand';
import type { VideoIRDocument } from '@acc/ir/client';

export class TrimSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private deltaStart: number;
  private deltaDuration: number;

  constructor(sequenceId: string, deltaStart: number, deltaDuration: number) {
    this.id = `trim_${sequenceId}_${Date.now()}`;
    this.description = `Trim sequence ${sequenceId} (${deltaStart}f, ${deltaDuration}f)`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.deltaStart = deltaStart;
    this.deltaDuration = deltaDuration;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    return this.applyDelta(doc, this.deltaStart, this.deltaDuration);
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    return this.applyDelta(doc, -this.deltaStart, -this.deltaDuration);
  }

  public tryMerge(next: ICommand): boolean {
    if (next instanceof TrimSequenceCommand && next.sequenceId === this.sequenceId) {
      this.deltaStart += next.deltaStart;
      this.deltaDuration += next.deltaDuration;
      return true;
    }
    return false;
  }

  private applyDelta(doc: VideoIRDocument, dStart: number, dDur: number): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;
    for (const track of copy.tracks) {
      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId) {
          // Mutate start
          if (typeof seq.time.start === 'number') {
            seq.time.start = Math.max(0, seq.time.start + dStart);
          } else if (seq.time.start && typeof seq.time.start === 'object') {
            const currentOffset = seq.time.start.offsetFrames ?? 0;
            seq.time.start.offsetFrames = currentOffset + dStart;
          }

          // Mutate duration
          if (typeof seq.time.duration === 'number') {
            seq.time.duration = Math.max(1, seq.time.duration + dDur);
          } else if (seq.time.duration && typeof seq.time.duration === 'object') {
            const currentPad = seq.time.duration.paddingFrames ?? 0;
            seq.time.duration.paddingFrames = currentPad + dDur;
          }
          return copy;
        }
      }
    }
    return copy;
  }
}
