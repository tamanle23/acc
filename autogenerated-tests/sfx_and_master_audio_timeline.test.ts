import { describe, it, expect } from 'bun:test';
import {
  TimelineEngine,
  SoundEffectsTimelineStrategy,
  MasterAudioTimingStrategy,
  type SFXClipConfig,
  type AudioTrackConfig,
  type ITimelineTrack,
} from '@acc/core';

describe('Multi-Track SFX and Master Voiceover Timeline Integration Tests', () => {
  it('evaluates discrete SFX events and accurately tracks active sound clips', () => {
    const sfxItems: SFXClipConfig[] = [
      { source: 'whoosh.wav', time: 1.0, duration: 0.5, volume: 0.8, duckBgm: true },
      { source: 'explosion.wav', time: 3.0, duration: 1.5, volume: 1.0, duckBgm: true },
    ];

    const strategy = new SoundEffectsTimelineStrategy();
    const track: ITimelineTrack<SFXClipConfig, any> = {
      id: 'track_sfx',
      type: 'sfx',
      duration: 10.0,
      items: sfxItems,
      strategy,
    };

    const engine = new TimelineEngine();
    engine.addTrack(track);

    // At t = 0.5 (before whoosh)
    let state = engine.getTrackState<any>('track_sfx', 0.5);
    expect(state.isEmittingAudio).toBe(false);
    expect(state.activeClips.length).toBe(0);

    // At t = 1.2 (during whoosh)
    state = engine.getTrackState<any>('track_sfx', 1.2);
    expect(state.isEmittingAudio).toBe(true);
    expect(state.activeClips.length).toBe(1);
    expect(state.activeClips[0].source).toBe('whoosh.wav');

    // At t = 2.0 (between whoosh and explosion)
    state = engine.getTrackState<any>('track_sfx', 2.0);
    expect(state.isEmittingAudio).toBe(false);
    expect(state.activeClips.length).toBe(0);

    // At t = 3.5 (during explosion)
    state = engine.getTrackState<any>('track_sfx', 3.5);
    expect(state.isEmittingAudio).toBe(true);
    expect(state.activeClips.length).toBe(1);
    expect(state.activeClips[0].source).toBe('explosion.wav');
  });

  it('evaluates continuous master audio timeline clock state', () => {
    const masterAudioConfig: AudioTrackConfig = {
      source: 'narration.mp3',
      volume: 1.0,
      timeBase: 'master',
    };

    const strategy = new MasterAudioTimingStrategy(15.0);
    const track: ITimelineTrack<AudioTrackConfig, any> = {
      id: 'track_master_audio',
      type: 'audio',
      duration: 15.0,
      items: [masterAudioConfig],
      strategy,
    };

    const engine = new TimelineEngine();
    engine.addTrack(track);

    const state = engine.getTrackState<any>('track_master_audio', 7.5);
    expect(state.isPlaying).toBe(true);
    expect(state.timeSec).toBe(7.5);
    expect(state.volume).toBe(1.0);
    expect(state.duration).toBe(15.0);

    const statePast = engine.getTrackState<any>('track_master_audio', 16.0);
    expect(statePast.isPlaying).toBe(false);
  });
});
