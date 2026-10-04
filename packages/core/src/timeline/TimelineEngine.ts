import type { ITimelineTrack } from '../types';

export class TimelineEngine {
  private tracks: Map<string, ITimelineTrack> = new Map();

  public addTrack<TItem, TSnapshot>(track: ITimelineTrack<TItem, TSnapshot>): this {
    this.tracks.set(track.id, track);
    return this;
  }

  public removeTrack(trackId: string): boolean {
    return this.tracks.delete(trackId);
  }

  public getTrack<TItem, TSnapshot>(trackId: string): ITimelineTrack<TItem, TSnapshot> | undefined {
    return this.tracks.get(trackId);
  }

  public getTrackState<TSnapshot>(trackId: string, timeSec: number, trackOptions?: any): TSnapshot {
    const track = this.tracks.get(trackId);
    if (!track) {
      throw new Error(`[TimelineEngine] Track "${trackId}" does not exist in registry.`);
    }

    const localTime = timeSec + (track.timeOffset || 0);
    return track.strategy.evaluate(track.items, localTime, trackOptions);
  }

  public getGlobalState(timeSec: number): Record<string, any> {
    const snapshot: Record<string, any> = {};
    for (const [id, track] of this.tracks.entries()) {
      const localTime = timeSec + (track.timeOffset || 0);
      snapshot[id] = track.strategy.evaluate(track.items, localTime);
    }
    return snapshot;
  }

  public clear(): void {
    this.tracks.clear();
  }
}
