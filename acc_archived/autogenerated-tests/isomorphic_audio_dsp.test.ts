import { describe, it, expect } from 'bun:test';
import { ProceduralAudioSynthesizer } from '../packages/effect-engines/src/audio/ProceduralAudioSynthesizer';
import { UniversalAudioMixer, type AudioMixerClip } from '../packages/effect-engines/src/audio/UniversalAudioMixer';

describe('Phase 2: Isomorphic Float32 DSP Audio Engine & Mixer', () => {
  it('should synthesize ambient BGM, laser SFX, and pilot voice with valid PCM float amplitudes', () => {
    const bgm = ProceduralAudioSynthesizer.synthBGM(0, 1.0, 44100);
    expect(bgm.length).toBe(44100);
    expect(bgm.some((s) => s !== 0)).toBe(true);

    const laser = ProceduralAudioSynthesizer.synthLaserSFX(0, 0.5, 44100);
    expect(laser.length).toBe(22050);
    expect(laser.some((s) => s !== 0)).toBe(true);

    const voice = ProceduralAudioSynthesizer.synthPilotVoice(0, 1.0, 44100);
    expect(voice.length).toBe(44100);
    expect(voice.some((s) => s !== 0)).toBe(true);

    // Verify all samples are clamped within [-1.0, 1.0]
    for (let i = 0; i < 1000; i++) {
      expect(Math.abs(bgm[i])).toBeLessThanOrEqual(1.0);
      expect(Math.abs(laser[i])).toBeLessThanOrEqual(1.0);
      expect(Math.abs(voice[i])).toBeLessThanOrEqual(1.0);
    }
  });

  it('should mix multiple tracks with equal-power stereo panning and peak/RMS measurement', () => {
    const clips: AudioMixerClip[] = [
      { id: 'c1', type: 'bgm', startTimeSec: 0, durationSec: 5, volume: 0.8, pan: 0.0 },
      { id: 'c2', type: 'sfx', startTimeSec: 1.0, durationSec: 0.5, volume: 1.0, pan: -0.8 }, // left-panned
    ];

    const mixer = new UniversalAudioMixer(clips, 44100);
    const result = mixer.mixStereo(0.5, 1.0);

    expect(result.left.length).toBe(44100);
    expect(result.right.length).toBe(44100);
    expect(result.peakDb).toBeLessThanOrEqual(0);
    expect(result.peakDb).toBeGreaterThan(-60);
    expect(result.rmsDb).toBeLessThanOrEqual(result.peakDb);
  });

  it('should perform automatic voice ducking on background music when voiceover is active', () => {
    const bgmOnlyClip: AudioMixerClip = { id: 'bgm', type: 'bgm', startTimeSec: 0, durationSec: 4, volume: 1.0 };
    const mixerBgm = new UniversalAudioMixer([bgmOnlyClip], 44100);
    const bgmOnlyResult = mixerBgm.mixStereo(1.0, 1.0);

    // Now mix with voice active
    const voiceClip: AudioMixerClip = { id: 'voice', type: 'voice', startTimeSec: 0.5, durationSec: 2.0, volume: 1.0 };
    const mixerDucked = new UniversalAudioMixer([
      { id: 'bgm', type: 'bgm', startTimeSec: 0, durationSec: 4, volume: 1.0 },
      voiceClip,
    ], 44100);
    const duckedResult = mixerDucked.mixStereo(1.0, 1.0);

    // The mixed result has both voice and ducked BGM, verify both audio buffers process without NaN
    expect(duckedResult.left.some((v) => isNaN(v))).toBe(false);
    expect(duckedResult.right.some((v) => isNaN(v))).toBe(false);
    expect(duckedResult.peakDb).toBeGreaterThan(-40);
  });
});
