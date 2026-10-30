import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence, BlendMode, TimedTextCue } from '@acc/ir';

export interface UpdateSequenceProperties {
  blendMode?: BlendMode;
  assetId?: string;
  activeStreams?: string[];
  cues?: TimedTextCue[];
  [key: string]: unknown;
}

export class UpdateSequencePropsCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private updates: UpdateSequenceProperties;
  private previousSnapshot: Partial<IRSequence> | null = null;

  constructor(sequenceId: string, updates: UpdateSequenceProperties) {
    this.id = `seq_prop_${sequenceId}_${Date.now()}`;
    this.description = `Update sequence properties for ${sequenceId}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.updates = JSON.parse(JSON.stringify(updates));
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId) {
          if (this.previousSnapshot === null) {
            this.previousSnapshot = JSON.parse(JSON.stringify(seq));
          }

          Object.assign(seq, this.updates);

          return copy;
        }
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.previousSnapshot) return doc;
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId) {
          Object.assign(seq, this.previousSnapshot);
          return copy;
        }
      }
    }

    return copy;
  }

  public tryMerge(next: ICommand): boolean {
    if (next instanceof UpdateSequencePropsCommand) {
      if (next.sequenceId === this.sequenceId && next.timestamp - this.timestamp < 500) {
        this.updates = { ...this.updates, ...next.updates };
        return true;
      }
    }
    return false;
  }
}
