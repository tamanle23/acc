import type { ICommand } from './ICommand';
import type { VideoIRDocument } from '@acc/ir';

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

          // Symmetrical linked sequence trimming if editorial/av_link is present and enabled
          const avLink = seq.modifiers?.find((m) => m.type === 'editorial/av_link');
          if (avLink && avLink.params?.enabled !== false && avLink.params?.linkedSequenceId && avLink.params?.syncTrim !== false) {
            const linkedId = avLink.params.linkedSequenceId as string;
            for (const t of copy.tracks) {
              const linkedSeq = t.sequences.find((s) => s.id === linkedId);
              if (linkedSeq) {
                if (typeof linkedSeq.time.start === 'number') {
                  linkedSeq.time.start = Math.max(0, linkedSeq.time.start + dStart);
                } else if (linkedSeq.time.start && typeof linkedSeq.time.start === 'object') {
                  const currentOffset = linkedSeq.time.start.offsetFrames ?? 0;
                  linkedSeq.time.start.offsetFrames = currentOffset + dStart;
                }
                if (typeof linkedSeq.time.duration === 'number') {
                  linkedSeq.time.duration = Math.max(1, linkedSeq.time.duration + dDur);
                } else if (linkedSeq.time.duration && typeof linkedSeq.time.duration === 'object') {
                  const currentPad = linkedSeq.time.duration.paddingFrames ?? 0;
                  linkedSeq.time.duration.paddingFrames = currentPad + dDur;
                }
                break;
              }
            }
          }

          return copy;
        }
      }
    }
    return copy;
  }
}
