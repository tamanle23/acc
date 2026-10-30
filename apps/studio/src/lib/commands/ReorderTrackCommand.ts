import type { ICommand } from './ICommand';
import { type VideoIRDocument, type IRTrack, VideoIRAuthoringEngine } from '@acc/ir';

export class ReorderTrackCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private trackId: string;
  private direction: 'up' | 'down';
  private previousTracksSnapshot: IRTrack[] | null = null;

  constructor(trackId: string, direction: 'up' | 'down') {
    this.id = `reorder_track_${trackId}_${direction}_${Date.now()}`;
    this.description = `Reorder track ${trackId} ${direction}`;
    this.timestamp = Date.now();
    this.trackId = trackId;
    this.direction = direction;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    if (this.previousTracksSnapshot === null && Array.isArray(doc.tracks)) {
      this.previousTracksSnapshot = JSON.parse(JSON.stringify(doc.tracks));
    }
    return VideoIRAuthoringEngine.reorderTrackInGroup(doc, this.trackId, this.direction);
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.previousTracksSnapshot) return doc;
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;
    copy.tracks = JSON.parse(JSON.stringify(this.previousTracksSnapshot));
    return copy;
  }

  public tryMerge(_next: ICommand): boolean {
    return false;
  }
}
