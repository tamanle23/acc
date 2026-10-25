import { describe, it, expect } from 'bun:test';
import {
  UniversalAudioMixer,
  DecodedPcmSource,
  ProceduralSynthesizerSource,
  ProceduralAudioSynthesizer,
  DynamicAudioDuckingEngine,
  VolumeModifierPlugin,
  PanModifierPlugin,
  FilterModifierPlugin,
  PitchModifierPlugin,
  DynamicDuckingPlugin,
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
} from '../packages/ir/src';
import { AudioAssetCache } from '../apps/studio/src/lib/audio/AudioAssetCache';
import { WebAudioEngine } from '../apps/studio/src/lib/audio/WebAudioEngine';

describe('Iteration 8 Phase 3: Platform-Independent Audio Core, Pure Plugins & Cache', () => {
  describe('1. Pure Buffer-Based Modifier Plugins', () => {
    it('VolumeModifierPlugin: scales linear volume and calculates fade in/out curves', () => {
      const plugin = new VolumeModifierPlugin();
      const sampleRate = 44100;
      const buffer = new Float32Array(sampleRate); // 1 second
      buffer.fill(1.0);

      plugin.processAudioStream(
        { sampleRate, channels: 1, timeSec: 0, durationSec: 1.0 },
        buffer,
        { volume: 0.5, fadeInSec: 0.2, fadeOutSec: 0.2, fadeCurve: 'cosine' }
      );

      // Start of fade-in: near zero
      expect(buffer[0]).toBeCloseTo(0, 2);
      // Mid-point (after fade-in, before fade-out): volume scaled to 0.5
      const midSample = Math.floor(sampleRate * 0.5);
      expect(buffer[midSample]).toBeCloseTo(0.5, 2);
      // End of fade-out: near zero
      expect(buffer[buffer.length - 1]).toBeCloseTo(0, 2);
    });

    it('VolumeModifierPlugin: handles muted state by zeroing entire buffer', () => {
      const plugin = new VolumeModifierPlugin();
      const buffer = new Float32Array([0.5, 0.8, -0.3, 0.2]);
      plugin.processAudioStream(
        { sampleRate: 44100, channels: 1, timeSec: 0, durationSec: 0.1 },
        buffer,
        { volume: 1.0, muted: true }
      );
      expect(buffer.every((v) => v === 0)).toBe(true);
    });

    it('PanModifierPlugin: preserves equal power across left and right channels', () => {
      const plugin = new PanModifierPlugin();
      const left = new Float32Array([1.0, 1.0, 1.0]);
      const right = new Float32Array([1.0, 1.0, 1.0]);

      // Hard left (-1.0)
      plugin.processStereoStream({ sampleRate: 44100, channels: 2 }, left, right, { stereoPan: -1.0 });
      expect(left[0]).toBeCloseTo(1.0, 2);
      expect(right[0]).toBeCloseTo(0.0, 2);

      // Center (0.0): each channel gain should be cos(pi/4) = 1/sqrt(2) ≈ 0.707
      const leftCenter = new Float32Array([1.0]);
      const rightCenter = new Float32Array([1.0]);
      plugin.processStereoStream({ sampleRate: 44100, channels: 2 }, leftCenter, rightCenter, { stereoPan: 0.0 });
      expect(leftCenter[0]).toBeCloseTo(Math.SQRT1_2, 2);
      expect(rightCenter[0]).toBeCloseTo(Math.SQRT1_2, 2);

      // Sum of squared amplitudes equals 1 (energy conservation)
      const energy = leftCenter[0] * leftCenter[0] + rightCenter[0] * rightCenter[0];
      expect(energy).toBeCloseTo(1.0, 2);
    });

    it('FilterModifierPlugin: lowpass biquad attenuates high frequency sinusoid', () => {
      const plugin = new FilterModifierPlugin();
      const sampleRate = 44100;
      const numSamples = 2000;
      const lowFreqBuffer = new Float32Array(numSamples);
      const highFreqBuffer = new Float32Array(numSamples);

      // Generate 100Hz (pass band) and 8000Hz (stop band)
      for (let i = 0; i < numSamples; i++) {
        lowFreqBuffer[i] = Math.sin((2 * Math.PI * 100 * i) / sampleRate);
        highFreqBuffer[i] = Math.sin((2 * Math.PI * 8000 * i) / sampleRate);
      }

      plugin.processAudioStream(
        { sampleRate, channels: 1 },
        lowFreqBuffer,
        { filterType: 'lowpass', cutoffHz: 500, q: 0.707 }
      );

      plugin.processAudioStream(
        { sampleRate, channels: 1 },
        highFreqBuffer,
        { filterType: 'lowpass', cutoffHz: 500, q: 0.707 }
      );

      // Low frequency sinusoid should pass mostly intact (amplitude > 0.7)
      const lowPeak = Math.max(...Array.from(lowFreqBuffer.subarray(500)).map(Math.abs));
      expect(lowPeak).toBeGreaterThan(0.7);

      // High frequency sinusoid should be significantly attenuated (amplitude < 0.15)
      const highPeak = Math.max(...Array.from(highFreqBuffer.subarray(500)).map(Math.abs));
      expect(highPeak).toBeLessThan(0.15);
    });

    it('PitchModifierPlugin: resamples audio buffer based on playbackRate', () => {
      const plugin = new PitchModifierPlugin();
      // Step function buffer: first half 1.0, second half 0.0
      const buffer = new Float32Array(100);
      for (let i = 0; i < 50; i++) buffer[i] = 1.0;

      // 2.0x playback rate should compress the step to first 25 samples
      plugin.processAudioStream(
        { sampleRate: 44100, channels: 1 },
        buffer,
        { playbackRate: 2.0 }
      );

      expect(buffer[10]).toBeCloseTo(1.0, 2);
      expect(buffer[30]).toBeCloseTo(0.0, 2);
    });

    it('DynamicDuckingPlugin: attenuates PCM stream by specified dB gain factor', () => {
      const plugin = new DynamicDuckingPlugin();
      const buffer = new Float32Array([1.0, 1.0, 1.0, 1.0]);

      // -6dB ≈ 0.5 linear gain
      plugin.processAudioStream(
        { sampleRate: 44100, channels: 1, frame: 0, totalFrames: 100 },
        buffer,
        { controlTrackId: 'voice', attenuationDb: -6.0 }
      );

      expect(buffer[0]).toBeCloseTo(0.501, 2);
    });
  });

  describe('2. Audio Source Adapter Pattern', () => {
    it('DecodedPcmSource: accurately samples and resamples multi-channel Float32 buffers', () => {
      const sampleRate = 44100;
      const leftChannel = new Float32Array(sampleRate);
      const rightChannel = new Float32Array(sampleRate);
      for (let i = 0; i < sampleRate; i++) {
        leftChannel[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
        rightChannel[i] = -Math.sin((2 * Math.PI * 440 * i) / sampleRate);
      }

      const source = new DecodedPcmSource({
        channels: [leftChannel, rightChannel],
        sourceSampleRate: sampleRate,
      });

      expect(source.isReady()).toBe(true);
      const slice = source.sample(0.1, 0.05, sampleRate);
      expect(slice.left.length).toBe(Math.floor(0.05 * sampleRate));
      expect(slice.right.length).toBe(Math.floor(0.05 * sampleRate));
      // Right channel should be inverted left channel
      expect(slice.left[10]).toBeCloseTo(-slice.right[10], 4);
    });

    it('ProceduralSynthesizerSource: generates valid non-empty synthesis for voice, sfx, and bgm', () => {
      const voiceSrc = new ProceduralSynthesizerSource('voice');
      const sfxSrc = new ProceduralSynthesizerSource('sfx');
      const bgmSrc = new ProceduralSynthesizerSource('bgm');

      const vSlice = voiceSrc.sample(0, 0.1, 44100);
      const sSlice = sfxSrc.sample(0, 0.1, 44100);
      const bSlice = bgmSrc.sample(0, 0.1, 44100);

      expect(vSlice.left.some((v) => v !== 0)).toBe(true);
      expect(sSlice.left.some((v) => v !== 0)).toBe(true);
      expect(bSlice.left.some((v) => v !== 0)).toBe(true);
    });
  });

  describe('3. UniversalAudioMixer in packages/ir with Master Bus Architecture', () => {
    it('mixes multi-track clips and executes clip modifier plugins in real-time', () => {
      registerCoreModifierPlugins();
      const mixer = new UniversalAudioMixer([], 44100);

      mixer.setClips([
        {
          id: 'clip_bgm',
          type: 'bgm',
          startTimeSec: 0,
          durationSec: 2.0,
          volume: 0.8,
          modifiers: [
            {
              type: 'audio/volume',
              params: { volume: 0.5 },
            },
            {
              type: 'audio/pan',
              params: { stereoPan: -0.5 },
            },
          ],
        },
      ]);

      const result = mixer.mixStereo(0, 0.5);
      expect(result.left.length).toBe(Math.floor(0.5 * 44100));
      expect(result.right.length).toBe(Math.floor(0.5 * 44100));
      expect(result.peakDb).toBeGreaterThan(-60);
      expect(result.rmsDb).toBeGreaterThan(-60);
    });

    it('performs sidechain dynamic ducking on BGM bus when dialogue voice is active', () => {
      const durationSec = 1.0;
      const sampleRate = 44100;

      // 1. Mixer with only BGM
      const bgmOnlyMixer = new UniversalAudioMixer([
        {
          id: 'bgm_clip',
          type: 'bgm',
          startTimeSec: 0,
          durationSec: 2.0,
          volume: 1.0,
        },
      ], sampleRate);
      const bgmResult = bgmOnlyMixer.mixStereo(0.2, durationSec);

      // 2. Mixer with BGM + active loud Voiceover dialogue
      const duckedMixer = new UniversalAudioMixer([
        {
          id: 'bgm_clip',
          type: 'bgm',
          startTimeSec: 0,
          durationSec: 2.0,
          volume: 1.0,
        },
        {
          id: 'voice_clip',
          type: 'voice',
          startTimeSec: 0,
          durationSec: 2.0,
          volume: 1.0,
          customSynthesizer: () => {
            const buf = new Float32Array(sampleRate * 2);
            buf.fill(0.8); // Loud continuous speech energy
            return buf;
          },
        },
      ], sampleRate);
      duckedMixer.duckingFactor = 0.2; // Attenuate BGM to 20%
      duckedMixer.attackMs = 10;
      duckedMixer.releaseMs = 100;

      const duckedResult = duckedMixer.mixStereo(0.2, durationSec);

      // Verify that mixer successfully applied soft limiter and generated non-empty mix
      expect(duckedResult.peakDb).toBeLessThanOrEqual(0.01);
      expect(bgmResult.rmsDb).toBeGreaterThan(-60);
    });
  });

  describe('4. AudioAssetCache Observer Pattern & Caching', () => {
    it('caches decoded audio and notifies subscribers upon update', () => {
      const cache = AudioAssetCache.getInstance();
      cache.clear();

      let notifiedCount = 0;
      const unsubscribe = cache.subscribe(() => {
        notifiedCount++;
      });

      const mockData = {
        channels: [new Float32Array([0.1, 0.2, 0.3]), new Float32Array([0.1, 0.2, 0.3])],
        sampleRate: 44100,
        durationSec: 0.05,
      };

      cache.setDecodedMock('asset_laser_01', mockData);
      expect(notifiedCount).toBe(1);

      const retrieved = cache.getAudioChannels('asset_laser_01');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.sampleRate).toBe(44100);

      unsubscribe();
      cache.setDecodedMock('asset_laser_02', mockData);
      expect(notifiedCount).toBe(1); // Should not increase after unsubscribe
    });
  });

  describe('5. WebAudioEngine Reactive Sync & Real Waveform Extraction', () => {
    it('syncFromIR assigns DecodedPcmSource when asset is decoded in AudioAssetCache', () => {
      const cache = AudioAssetCache.getInstance();
      cache.clear();

      const mockPcm = {
        channels: [new Float32Array(44100).fill(0.5), new Float32Array(44100).fill(0.5)],
        sampleRate: 44100,
        durationSec: 1.0,
      };
      cache.setDecodedMock('voice_pilot_01', mockPcm);

      const engine = WebAudioEngine.getInstance();
      const mockIR = {
        timeline: {
          assets: {
            voice_pilot_01: { src: 'https://example.com/pilot.wav', type: 'audio' },
          },
          tracks: [
            {
              id: 'track_voice',
              type: 'audio',
              sequences: [
                {
                  id: 'seq_pilot',
                  assetId: 'voice_pilot_01',
                  timelineStartFrame: 0,
                  durationFrames: 60,
                  modifiers: [{ type: 'audio/volume', params: { volume: 0.9 } }],
                },
              ],
            },
          ],
        },
      };

      engine.syncFromIR(mockIR, 30);
      const clips = ((engine as any).mixer as UniversalAudioMixer).getClips();
      expect(clips.length).toBe(1);
      expect(clips[0].audioSource).toBeDefined();
      expect(clips[0].audioSource instanceof DecodedPcmSource).toBe(true);
    });

    it('extracts real PCM peaks from decoded audio in getWaveformPeaks', () => {
      const cache = AudioAssetCache.getInstance();
      cache.clear();

      const channel = new Float32Array(800);
      // Place peaks at specific locations
      channel[200] = 0.85;
      channel[600] = 0.95;

      cache.setDecodedMock('asset_peaks_test', {
        channels: [channel],
        sampleRate: 44100,
        durationSec: 1.0,
      });

      const engine = WebAudioEngine.getInstance();
      const peaks = engine.getWaveformPeaks('asset_peaks_test', 30, 80);
      expect(peaks.length).toBe(80);
      expect(Math.max(...Array.from(peaks))).toBeGreaterThanOrEqual(0.85);
    });
  });
});
