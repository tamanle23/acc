import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence, BlendMode, TimedTextCue } from '@acc/ir';

export interface UpdateSequenceProperties {
  blendMode?: BlendMode;
  assetId?: string;
  activeStreams?: string[];
  cues?: TimedTextCue[];
  [key: string]: any;
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
            this.previousSnapshot = {
              blendMode: seq.blendMode,
              assetId: seq.assetId,
              activeStreams: seq.activeStreams ? [...seq.activeStreams] : undefined,
              cues: seq.cues ? JSON.parse(JSON.stringify(seq.cues)) : undefined,
            };
          }

          if (this.updates.blendMode !== undefined) seq.blendMode = this.updates.blendMode;
          if (this.updates.assetId !== undefined) seq.assetId = this.updates.assetId;
          if (this.updates.activeStreams !== undefined) seq.activeStreams = [...this.updates.activeStreams];
          if (this.updates.cues !== undefined) seq.cues = JSON.parse(JSON.stringify(this.updates.cues));

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
          if (this.previousSnapshot.blendMode !== undefined) seq.blendMode = this.previousSnapshot.blendMode;
          else delete seq.blendMode;

          if (this.previousSnapshot.assetId !== undefined) seq.assetId = this.previousSnapshot.assetId;
          else delete seq.assetId;

          if (this.previousSnapshot.activeStreams !== undefined) seq.activeStreams = [...this.previousSnapshot.activeStreams];
          else delete seq.activeStreams;

          if (this.previousSnapshot.cues !== undefined) seq.cues = JSON.parse(JSON.stringify(this.previousSnapshot.cues));
          else delete seq.cues;

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
