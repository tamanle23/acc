import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence } from '../../../../../packages/ir/src/types/VideoIR';
import { VideoIRAuthoringEngine } from '../../../../../packages/ir/src/authoring/VideoIRAuthoringEngine';

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
  private nextSequenceIndexSnapshot: number | undefined = undefined;

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

        if (this.nextSequenceIndexSnapshot === undefined) {
          this.nextSequenceIndexSnapshot = copy.meta?.nextSequenceIndex;
        }

        if (!this.duplicatedSequence) {
          const alloc = VideoIRAuthoringEngine.allocateDuplicateSequenceId(copy, orig);
          const cloned: IRSequence = JSON.parse(JSON.stringify(orig));
          cloned.id = alloc.id;
          cloned.name = `${orig.name || orig.id} (Copy)`;

          // Adjust timeline position if explicit start frame is defined
          if (cloned.time && typeof cloned.time.start === 'number' && typeof cloned.time.duration === 'number' && typeof orig.time.start === 'number' && typeof orig.time.duration === 'number') {
            cloned.time.start = orig.time.start + orig.time.duration;
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

    if (copy.meta && this.nextSequenceIndexSnapshot !== undefined) {
      copy.meta.nextSequenceIndex = this.nextSequenceIndexSnapshot;
    }

    return copy;
  }
}
