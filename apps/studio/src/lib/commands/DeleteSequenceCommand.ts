import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence } from '@acc/ir/client';

/**
 * DeleteSequenceCommand:
 * Undoable command that removes a sequence from its track while preserving
 * full restoration capability via undo.
 */
export class DeleteSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private deletedSequence: IRSequence | null = null;
  private trackId: string | null = null;
  private originalIndex: number = -1;

  constructor(sequenceId: string) {
    this.id = `del_seq_${sequenceId}_${Date.now()}`;
    this.description = `Delete sequence ${sequenceId}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
  }

  public getDeletedSequence(): IRSequence | null {
    return this.deletedSequence;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      const idx = track.sequences.findIndex((s) => s.id === this.sequenceId);
      if (idx >= 0) {
        this.trackId = track.id;
        this.originalIndex = idx;
        this.deletedSequence = JSON.parse(JSON.stringify(track.sequences[idx]));
        track.sequences.splice(idx, 1);
        return copy;
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.deletedSequence || !this.trackId) return doc;
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    const track = copy.tracks.find((t) => t.id === this.trackId);
    if (track) {
      if (this.originalIndex >= 0 && this.originalIndex <= track.sequences.length) {
        track.sequences.splice(this.originalIndex, 0, JSON.parse(JSON.stringify(this.deletedSequence)));
      } else {
        track.sequences.push(JSON.parse(JSON.stringify(this.deletedSequence)));
      }
    }

    return copy;
  }
}
