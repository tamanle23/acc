import type { ICommand } from './ICommand';
import { type VideoIRDocument, type IRTrack, VideoIRAuthoringEngine } from '@acc/ir';

/**
 * AddTrackCommand:
 * Undoable command that appends or inserts a new track into the VideoIRDocument.
 * Adheres strictly to STATE-IMMUTABILITY and the Command Pattern.
 */
export class AddTrackCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private newTrack: IRTrack;
  private insertIndex?: number;

  constructor(track: IRTrack, insertIndex?: number) {
    this.id = `add_track_${track.id}_${Date.now()}`;
    this.description = `Add track ${track.name || track.id} (${track.type})`;
    this.timestamp = Date.now();
    this.newTrack = JSON.parse(JSON.stringify(track));
    this.insertIndex = insertIndex;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;
    if (!Array.isArray(copy.tracks)) {
      copy.tracks = [];
    }

    const existingIdx = copy.tracks.findIndex((t) => t.id === this.newTrack.id);
    if (existingIdx >= 0) {
      return copy;
    }

    const trackToAdd = JSON.parse(JSON.stringify(this.newTrack)) as IRTrack;
    if (trackToAdd.groupOrder === undefined) {
      const modality = VideoIRAuthoringEngine.getTrackModalityGroup(trackToAdd.type);
      const sameGroupTracks = copy.tracks.filter(
        (t) => VideoIRAuthoringEngine.getTrackModalityGroup(t.type) === modality
      );
      trackToAdd.groupOrder = sameGroupTracks.length;
    }

    if (
      this.insertIndex !== undefined &&
      this.insertIndex >= 0 &&
      this.insertIndex <= copy.tracks.length
    ) {
      copy.tracks.splice(this.insertIndex, 0, trackToAdd);
    } else {
      copy.tracks.push(trackToAdd);
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;
    if (Array.isArray(copy.tracks)) {
      copy.tracks = copy.tracks.filter((t) => t.id !== this.newTrack.id);
    }
    return copy;
  }
}
