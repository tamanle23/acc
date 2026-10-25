import type { ICommand } from './ICommand';
import type { VideoIRDocument } from '@acc/ir';

export class ReorderTrackCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private trackId: string;
  private direction: 'up' | 'down';
  private fromIndex: number = -1;
  private toIndex: number = -1;

  constructor(trackId: string, direction: 'up' | 'down') {
    this.id = `reorder_track_${trackId}_${direction}_${Date.now()}`;
    this.description = `Reorder track ${trackId} ${direction}`;
    this.timestamp = Date.now();
    this.trackId = trackId;
    this.direction = direction;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;
    const curIdx = copy.tracks.findIndex((t) => t.id === this.trackId);

    if (curIdx === -1) return copy;
    this.fromIndex = curIdx;

    if (this.direction === 'up' && curIdx > 0) {
      this.toIndex = curIdx - 1;
      const [moved] = copy.tracks.splice(curIdx, 1);
      copy.tracks.splice(this.toIndex, 0, moved);
    } else if (this.direction === 'down' && curIdx < copy.tracks.length - 1) {
      this.toIndex = curIdx + 1;
      const [moved] = copy.tracks.splice(curIdx, 1);
      copy.tracks.splice(this.toIndex, 0, moved);
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (this.fromIndex === -1 || this.toIndex === -1) return doc;
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    const curIdx = copy.tracks.findIndex((t) => t.id === this.trackId);
    if (curIdx !== -1) {
      const [moved] = copy.tracks.splice(curIdx, 1);
      copy.tracks.splice(this.fromIndex, 0, moved);
    }

    return copy;
  }

  public tryMerge(_next: ICommand): boolean {
    return false;
  }
}
