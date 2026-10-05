import type { ITimelineStrategy, SFXClipConfig, SFXTrackSnapshot } from '../types';

export class SoundEffectsTimelineStrategy implements ITimelineStrategy<SFXClipConfig, SFXTrackSnapshot> {
  public readonly strategyId = 'sfx-timeline-v1';

  public evaluate(items: SFXClipConfig[], localTimeSec: number): SFXTrackSnapshot {
    if (!items || items.length === 0) {
      return {
        activeClips: [],
        isEmittingAudio: false,
      };
    }

    const activeClips = items.filter(clip => {
      const start = clip.time || 0;
      const duration = clip.duration !== undefined ? clip.duration : 2.0; // fallback default window
      return localTimeSec >= start && localTimeSec < start + duration;
    });

    return {
      activeClips,
      isEmittingAudio: activeClips.length > 0,
    };
  }
}
