import type { ICommand } from './ICommand';
import type { VideoIRDocument, SequenceTime } from '@acc/ir';

export class UpdateSequenceTimeCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private newTime: SequenceTime;
  private previousTimeSnapshot: SequenceTime | null = null;

  constructor(sequenceId: string, newTime: SequenceTime) {
    this.id = `time_${sequenceId}_${Date.now()}`;
    this.description = `Update timing for sequence ${sequenceId}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.newTime = JSON.parse(JSON.stringify(newTime));
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId) {
          if (this.previousTimeSnapshot === null) {
            this.previousTimeSnapshot = JSON.parse(JSON.stringify(seq.time));
          }
          seq.time = JSON.parse(JSON.stringify(this.newTime));
          return copy;
        }
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.previousTimeSnapshot) return doc;
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId) {
          seq.time = JSON.parse(JSON.stringify(this.previousTimeSnapshot));
          return copy;
        }
      }
    }

    return copy;
  }

  public tryMerge(next: ICommand): boolean {
    if (next instanceof UpdateSequenceTimeCommand && next.sequenceId === this.sequenceId) {
      // Merge rapid successive edits into current command
      this.newTime = JSON.parse(JSON.stringify(next.newTime));
      return true;
    }
    return false;
  }
}
