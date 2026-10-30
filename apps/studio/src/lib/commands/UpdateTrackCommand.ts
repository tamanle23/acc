import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRTrack, BlendMode, ModifierNode } from '@acc/ir';

export interface UpdateTrackProperties {
  name?: string;
  blendMode?: BlendMode;
  routeTo?: string;
  parentTrack?: string;
  style?: Record<string, unknown>;
  modifiers?: ModifierNode[];
  [key: string]: unknown;
}

export class UpdateTrackCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private trackId: string;
  private updates: UpdateTrackProperties;
  private previousSnapshot: Partial<IRTrack> | null = null;

  constructor(trackId: string, updates: UpdateTrackProperties) {
    this.id = `track_prop_${trackId}_${Date.now()}`;
    this.description = `Update track properties for ${trackId}`;
    this.timestamp = Date.now();
    this.trackId = trackId;
    this.updates = JSON.parse(JSON.stringify(updates));
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;
    const targetTrack = copy.tracks.find((t) => t.id === this.trackId);

    if (targetTrack) {
      if (this.previousSnapshot === null) {
        this.previousSnapshot = {
          name: targetTrack.name,
          blendMode: targetTrack.blendMode,
          routeTo: targetTrack.routeTo,
          parentTrack: targetTrack.parentTrack,
          style: targetTrack.style ? JSON.parse(JSON.stringify(targetTrack.style)) : undefined,
          modifiers: targetTrack.modifiers ? JSON.parse(JSON.stringify(targetTrack.modifiers)) : undefined,
        };
      }

      if (this.updates.name !== undefined) targetTrack.name = this.updates.name;
      if (this.updates.blendMode !== undefined) targetTrack.blendMode = this.updates.blendMode;
      if (this.updates.routeTo !== undefined) targetTrack.routeTo = this.updates.routeTo;
      if (this.updates.parentTrack !== undefined) targetTrack.parentTrack = this.updates.parentTrack;
      if (this.updates.style !== undefined) {
        targetTrack.style = { ...(targetTrack.style || {}), ...this.updates.style };
      }
      if (this.updates.modifiers !== undefined) {
        targetTrack.modifiers = JSON.parse(JSON.stringify(this.updates.modifiers));
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.previousSnapshot) return doc;
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;
    const targetTrack = copy.tracks.find((t) => t.id === this.trackId);

    if (targetTrack) {
      if (this.previousSnapshot.name !== undefined) targetTrack.name = this.previousSnapshot.name;
      else delete targetTrack.name;

      if (this.previousSnapshot.blendMode !== undefined) targetTrack.blendMode = this.previousSnapshot.blendMode;
      else delete targetTrack.blendMode;

      if (this.previousSnapshot.routeTo !== undefined) targetTrack.routeTo = this.previousSnapshot.routeTo;
      else delete targetTrack.routeTo;

      if (this.previousSnapshot.parentTrack !== undefined) targetTrack.parentTrack = this.previousSnapshot.parentTrack;
      else delete targetTrack.parentTrack;

      if (this.previousSnapshot.style !== undefined) targetTrack.style = JSON.parse(JSON.stringify(this.previousSnapshot.style));
      else delete targetTrack.style;

      if (this.previousSnapshot.modifiers !== undefined) targetTrack.modifiers = JSON.parse(JSON.stringify(this.previousSnapshot.modifiers));
      else delete targetTrack.modifiers;
    }

    return copy;
  }

  public tryMerge(next: ICommand): boolean {
    if (next instanceof UpdateTrackCommand) {
      if (next.trackId === this.trackId && next.timestamp - this.timestamp < 500) {
        this.updates = { ...this.updates, ...next.updates };
        return true;
      }
    }
    return false;
  }
}
