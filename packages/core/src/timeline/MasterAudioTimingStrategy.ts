import type { ITimelineStrategy, AudioTrackConfig } from '../types';

export interface MasterAudioTrackSnapshot {
  isPlaying: boolean;
  timeSec: number;
  duration: number;
  volume: number;
}

export class MasterAudioTimingStrategy implements ITimelineStrategy<AudioTrackConfig, MasterAudioTrackSnapshot> {
  public readonly strategyId = 'master-audio-timing-v1';

  constructor(private totalDuration: number = 0) {}

  public evaluate(items: AudioTrackConfig[], localTimeSec: number): MasterAudioTrackSnapshot {
    const config = items[0];
    const volume = config?.volume ?? 1.0;
    const isPlaying = localTimeSec >= 0 && (this.totalDuration === 0 || localTimeSec <= this.totalDuration);

    return {
      isPlaying,
      timeSec: localTimeSec,
      duration: this.totalDuration,
      volume,
    };
  }
}
