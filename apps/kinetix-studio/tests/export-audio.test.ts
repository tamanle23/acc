import { describe, it, expect } from 'bun:test';
import { resolveExportAudioBuffer } from '../src/lib/export-audio';
import { INITIAL_STUDIO_STATE } from '../src/constants/initial-state';
import { userAudioTrack } from '../src/engine/audio-user-track';

describe('Deterministic Audio Export Resolver Suite', () => {
  it('always produces an offline audio track buffer even when live sound is muted', async () => {
    // In live editor, synthAudioSound is false by default so page does not autoplay
    const state = {
      ...INITIAL_STUDIO_STATE,
      audioReactive: false,
      synthAudioSound: false,
    };

    const buffer = await resolveExportAudioBuffer(state);
    expect(buffer).not.toBeNull();
    expect(buffer!.numberOfChannels).toBe(2);
    expect(buffer!.duration).toBeGreaterThan(0);
    expect(buffer!.sampleRate).toBe(44100);
    expect(buffer!.length).toBeGreaterThan(0);
  });

  it('renders audio buffer matching custom duration and BPM accurately', async () => {
    const customDuration = 4;
    const customBpm = 140;
    const state = {
      ...INITIAL_STUDIO_STATE,
      durationSec: customDuration,
      bpm: customBpm,
      synthPattern: 'techno-909-acid' as const,
    };

    const buffer = await resolveExportAudioBuffer(state);
    expect(buffer).not.toBeNull();
    expect(buffer!.duration).toBeCloseTo(customDuration, 1);
    expect(buffer!.length).toBe(customDuration * 44100);
  });

  it('prioritizes user audio track when audioSource is user-file', async () => {
    // Mock user audio buffer in userAudioTrack
    const mockUserBuffer = {
      length: 88200,
      duration: 2.0,
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(88200),
      copyFromChannel: () => {},
      copyToChannel: () => {},
    } as unknown as AudioBuffer;

    (userAudioTrack as any).audioBuffer = mockUserBuffer;

    const state = {
      ...INITIAL_STUDIO_STATE,
      audioSource: 'user-file' as const,
    };

    const buffer = await resolveExportAudioBuffer(state);
    expect(buffer).toBe(mockUserBuffer);

    // Reset user audio track
    (userAudioTrack as any).audioBuffer = null;
  });
});
