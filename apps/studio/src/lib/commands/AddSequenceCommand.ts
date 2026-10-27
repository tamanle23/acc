import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence, IRTrack, AssetDefinition } from '../../../../../packages/ir/src/types/VideoIR';
import { VideoIRAuthoringEngine } from '../../../../../packages/ir/src/authoring/VideoIRAuthoringEngine';

export interface AddSequenceOptions {
  trackTypeFallback?: 'video' | 'audio' | 'timed_text';
  trackNameFallback?: string;
  asset?: { id: string; asset: AssetDefinition };
}

/**
 * AddSequenceCommand:
 * Undoable command that inserts a newly staged sequence (Text, Shape, Partial VFX)
 * into a target track in the VideoIRDocument. Automatically provisions the track if missing.
 */
export class AddSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private targetTrackId: string;
  private sequence: IRSequence;
  private trackTypeFallback: 'video' | 'audio' | 'timed_text';
  private trackNameFallback: string;
  private asset?: { id: string; asset: AssetDefinition };
  private createdTrack: boolean = false;
  private nextSequenceIndexSnapshot: number | undefined = undefined;

  constructor(targetTrackId: string, sequence: IRSequence, options?: AddSequenceOptions) {
    this.id = `add_seq_${sequence.id}_${Date.now()}`;
    this.description = `Add sequence ${sequence.id} to track ${targetTrackId}`;
    this.timestamp = Date.now();
    this.targetTrackId = targetTrackId;
    this.sequence = JSON.parse(JSON.stringify(sequence));
    this.trackTypeFallback = options?.trackTypeFallback ?? 'video';
    this.trackNameFallback = options?.trackNameFallback ?? targetTrackId;
    this.asset = options?.asset ? JSON.parse(JSON.stringify(options.asset)) : undefined;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    if (this.nextSequenceIndexSnapshot === undefined) {
      this.nextSequenceIndexSnapshot = copy.meta?.nextSequenceIndex;
    }

    // 1. Register asset if provided
    if (this.asset) {
      if (!copy.assets) copy.assets = {};
      if (!copy.assets[this.asset.id]) {
        copy.assets[this.asset.id] = this.asset.asset;
      }
    }

    // 2. Locate or provision target track
    let track = copy.tracks.find((t) => t.id === this.targetTrackId);
    if (!track) {
      track = {
        id: this.targetTrackId,
        type: this.trackTypeFallback,
        name: this.trackNameFallback,
        sequences: [],
      };
      copy.tracks.push(track);
      this.createdTrack = true;
    }

    // 3. Assign or advance monotonic sequence ID if sequence ID is missing or temporary
    if (!this.sequence.id || this.sequence.id.startsWith('temp_')) {
      const allocated = VideoIRAuthoringEngine.allocateNextSequenceId(copy, {
        type: this.sequence.type,
        nameOrSlug: this.sequence.name,
      });
      this.sequence.id = allocated.id;
    }

    // 4. Append sequence if not already present
    const existingIdx = track.sequences.findIndex((s) => s.id === this.sequence.id);
    if (existingIdx >= 0) {
      track.sequences[existingIdx] = JSON.parse(JSON.stringify(this.sequence));
    } else {
      track.sequences.push(JSON.parse(JSON.stringify(this.sequence)));
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    const trackIndex = copy.tracks.findIndex((t) => t.id === this.targetTrackId);
    if (trackIndex >= 0) {
      const track = copy.tracks[trackIndex];
      track.sequences = track.sequences.filter((s) => s.id !== this.sequence.id);

      // If the track was created specifically by this command and is now empty, remove it
      if (this.createdTrack && track.sequences.length === 0) {
        copy.tracks.splice(trackIndex, 1);
      }
    }

    // Clean up asset if it was introduced solely by this command
    if (this.asset && copy.assets && copy.assets[this.asset.id]) {
      // Only remove if no other sequence references it
      let isReferenced = false;
      for (const t of copy.tracks) {
        if (t.sequences.some((s) => s.assetId === this.asset?.id)) {
          isReferenced = true;
          break;
        }
      }
      if (!isReferenced) {
        delete copy.assets[this.asset.id];
      }
    }

    if (copy.meta && this.nextSequenceIndexSnapshot !== undefined) {
      copy.meta.nextSequenceIndex = this.nextSequenceIndexSnapshot;
    }

    return copy;
  }
}
