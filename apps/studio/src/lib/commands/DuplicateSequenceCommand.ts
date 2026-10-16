import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence } from '@acc/ir/client';

/**
 * DuplicateSequenceCommand:
 * Undoable command that duplicates an existing sequence on its track,
 * assigning a unique ID, adjusting start frames if applicable, and maintaining DAG integrity.
 */
export class DuplicateSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private duplicatedSequence: IRSequence | null = null;
  private targetTrackId: string | null = null;
  private insertIndex: number = -1;

  constructor(sequenceId: string) {
    this.id = `dup_seq_${sequenceId}_${Date.now()}`;
    this.description = `Duplicate sequence ${sequenceId}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
  }

  public getDuplicatedId(): string | null {
    return this.duplicatedSequence ? this.duplicatedSequence.id : null;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      const idx = track.sequences.findIndex((s) => s.id === this.sequenceId);
      if (idx >= 0) {
        const orig = track.sequences[idx];
        this.targetTrackId = track.id;
        this.insertIndex = idx + 1;

        if (!this.duplicatedSequence) {
          const dupId = `${orig.id}_copy_${Math.random().toString(36).slice(2, 7)}`;
          const cloned: IRSequence = JSON.parse(JSON.stringify(orig));
          cloned.id = dupId;
          cloned.name = `${orig.name || orig.id} (Copy)`;

          // Adjust timeline position if explicit start frame is defined
          if (cloned.time && typeof (cloned.time as any).start === 'number' && typeof (cloned.time as any).duration === 'number') {
            (cloned.time as any).start = (orig.time as any).start + (orig.time as any).duration;
          } else if (cloned.timelineStartFrame !== undefined && cloned.durationFrames !== undefined) {
            cloned.timelineStartFrame = orig.timelineStartFrame! + orig.durationFrames;
          }

          this.duplicatedSequence = cloned;
        }

        track.sequences.splice(this.insertIndex, 0, JSON.parse(JSON.stringify(this.duplicatedSequence)));
        return copy;
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.duplicatedSequence || !this.targetTrackId) return doc;
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    const track = copy.tracks.find((t) => t.id === this.targetTrackId);
    if (track) {
      track.sequences = track.sequences.filter((s) => s.id !== this.duplicatedSequence!.id);
    }

    return copy;
  }
}
