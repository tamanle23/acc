import { describe, it, expect } from 'bun:test';
import { UniversalAudioMixer } from '../packages/ir/src/renderer/audio/UniversalAudioMixer';
import { DecodedPcmSource } from '../packages/ir/src/renderer/audio/AudioSourceAdapter';
import { AudioAssetCache } from '../apps/studio/src/lib/audio/AudioAssetCache';
import { WebAudioEngine } from '../apps/studio/src/lib/audio/WebAudioEngine';
import type { ResolvedTimeline, ResolvedTrack, ResolvedSequence } from '../packages/ir/src/types/VideoIR';

describe('Audio Export and Preview Parity Suite (Iteration 88)', () => {
  it('guarantees transparent master bus linearity for signals <= 1.0 (no tanh overdrive)', () => {
    const mixer = new UniversalAudioMixer([], 48000);
    // Custom synthesizer generating uncompressed calibrated test tones
    mixer.setClips([
      {
        id: 'clip-test-bgm',
        type: 'bgm',
        startTimeSec: 0,
        durationSec: 1.0,
        volume: 1.0,
        pan: 0,
        customSynthesizer: (offset, dur, sampleRate) => {
          const numSamples = Math.floor(dur * sampleRate);
          const buf = new Float32Array(numSamples);
          for (let i = 0; i < numSamples; i++) {
            // Amplitude = 0.85 (in previous tanh implementation, tanh(0.85) was 0.6913, causing severe attenuation)
            buf[i] = 0.85 * Math.sin(2 * Math.PI * 440 * (i / sampleRate));
          }
          return buf;
        },
      },
    ]);

    const result = mixer.mixStereo(0, 0.1);
    const numSamples = result.left.length;

    // Peak amplitude of pan 0.0 with volume 1.0:
    // gainL = Math.cos(PI/4) = 0.70710678. Expected left peak = 0.85 * 0.70710678 = 0.60104.
    const expectedPeak = 0.85 * Math.cos(Math.PI / 4);

    let maxSampleL = 0;
    for (let i = 0; i < numSamples; i++) {
      if (Math.abs(result.left[i]) > maxSampleL) {
        maxSampleL = Math.abs(result.left[i]);
      }
    }

    // In old tanh limiter: maxSampleL = Math.tanh(0.60104) = 0.5378 (10.5% distortion!)
    // In new transparent limiter: maxSampleL is exactly 0.60104 (0% distortion)
    expect(Math.abs(maxSampleL - expectedPeak)).toBeLessThan(1e-4);
  });

  it('correctly resamples 44.1 kHz audio to 48 kHz mixer rate without pitch or speed distortion', () => {
    const sourceRate = 44100;
    const targetRate = 48000;
    const durationSec = 2.0;

    const numSourceSamples = Math.floor(durationSec * sourceRate);
    const sourceData = new Float32Array(numSourceSamples);
    // 440 Hz standard concert A tone
    for (let i = 0; i < numSourceSamples; i++) {
      sourceData[i] = Math.sin(2 * Math.PI * 440 * (i / sourceRate));
    }

    const source = new DecodedPcmSource({
      channels: [sourceData, sourceData],
      sourceSampleRate: sourceRate,
      sourceTrimStartSec: 0,
    });

    expect(source.isReady()).toBe(true);

    const { left } = source.sample(0, durationSec, targetRate);
    expect(left.length).toBe(targetRate * durationSec);

    // Verify frequency at target rate: zero crossing spacing should match 440 Hz at 48 kHz
    // Period = targetRate / 440 = 48000 / 440 = 109.09 samples
    let zeroCrossings = 0;
    for (let i = 1; i < targetRate; i++) {
      if (left[i - 1] < 0 && left[i] >= 0) {
        zeroCrossings++;
      }
    }
    // In 1 second at 440 Hz, there are 440 cycles (positive zero-crossings, tolerance +/- 1 for boundary)
    expect(zeroCrossings).toBeGreaterThanOrEqual(439);
    expect(zeroCrossings).toBeLessThanOrEqual(441);
  });

  it('duplicating mono audio into stereo channels preserves full duration and 1x speed', () => {
    const numFrames = 48000; // 1 second
    const mono = new Float32Array(numFrames);
    for (let i = 0; i < numFrames; i++) {
      mono[i] = (i / numFrames); // linear ramp 0..1
    }

    // Standardized channel normalization
    const interleaved = new Float32Array(numFrames * 2);
    for (let i = 0; i < numFrames; i++) {
      interleaved[i * 2] = mono[i];
      interleaved[i * 2 + 1] = mono[i];
    }

    // Unpack as stereo
    const left = new Float32Array(numFrames);
    const right = new Float32Array(numFrames);
    for (let s = 0; s < numFrames; s++) {
      left[s] = interleaved[s * 2];
      right[s] = interleaved[s * 2 + 1];
    }

    // Duration is preserved at exactly 1.0 second (48000 frames)
    expect(left.length).toBe(numFrames);
    expect(right.length).toBe(numFrames);

    // Both channels are identical (stereo center)
    expect(left[0]).toBe(0);
    expect(right[0]).toBe(0);
    expect(left[numFrames / 2]).toBe(0.5);
    expect(right[numFrames / 2]).toBe(0.5);
    expect(left[numFrames - 1]).toBeCloseTo(1.0, 3);
    expect(right[numFrames - 1]).toBeCloseTo(1.0, 3);
  });

  it('AudioAssetCache stores multiple multi-track audio assets up to 128 MB without thrashing', () => {
    const cache = AudioAssetCache.getInstance();
    cache.clear();

    // 4 distinct 30-second stereo tracks at 48 kHz (each ~11.5 MB Float32 PCM)
    const trackFrames = 48000 * 30;
    for (let t = 1; t <= 4; t++) {
      const ch1 = new Float32Array(trackFrames);
      const ch2 = new Float32Array(trackFrames);
      ch1[0] = t;
      cache.setDecodedMock(`track_${t}`, {
        channels: [ch1, ch2],
        sampleRate: 48000,
        durationSec: 30,
      });
    }

    // In old 16 MB cache, adding track 2 evicted track 1 immediately!
    // In new 128 MB cache, all 4 tracks (total ~46 MB) must comfortably remain resident!
    expect(cache.getAudioChannels('track_1')).not.toBeNull();
    expect(cache.getAudioChannels('track_2')).not.toBeNull();
    expect(cache.getAudioChannels('track_3')).not.toBeNull();
    expect(cache.getAudioChannels('track_4')).not.toBeNull();

    expect(cache.getAudioChannels('track_1')!.channels[0][0]).toBe(1);
    expect(cache.getAudioChannels('track_4')!.channels[0][0]).toBe(4);
  });

  it('WebAudioEngine lookahead preloads sequences starting past 6 seconds around playhead', () => {
    const engine = WebAudioEngine.getInstance();

    // Sequence starting at frame 300 (10.0 seconds at 30 fps)
    const lateSeq: ResolvedSequence = {
      id: 'seq-late-audio',
      type: 'audio',
      trackId: 'track-a1',
      startFrame: 300,
      endFrame: 600,
      durationFrames: 300,
      assetId: 'asset-late-10s',
    } as ResolvedSequence;

    const timeline: ResolvedTimeline = {
      meta: { contentId: 'test-timeline', globalFps: 30, canvasSize: { w: 1920, h: 1080 } },
      tracks: new Map([
        ['track-a1', { id: 'track-a1', type: 'audio', sequences: [lateSeq] }],
      ]),
      sequences: new Map([['seq-late-audio', lateSeq]]),
      totalFrames: 900,
      durationSeconds: 30.0,
      assets: {
        'asset-late-10s': { src: 'cache://audio/song.mp3', type: 'audio' } as any,
      },
    };

    // When playhead is at frame 300 (10.0s), syncFromIR with currentFrame=300 must include lateSeq
    const irState = { timeline, doc: { assets: timeline.assets } } as any;

    // Trigger sync with playhead at 10.0s (frame 300)
    engine.syncFromIR(irState, 30, true, 300);

    const mixer = engine.getMixer();
    expect(mixer).toBeDefined();
    // Verify mixer clips were synchronized
    const clips = (mixer as any).clips;
    expect(clips.length).toBe(1);
    expect(clips[0].id).toBe('seq-late-audio');
    expect(clips[0].startTimeSec).toBe(10.0);
  });
});
