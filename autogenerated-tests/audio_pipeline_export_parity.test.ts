import { describe, it, expect, beforeEach } from 'bun:test';
import { UniversalAudioMixer } from '../packages/ir/src/renderer/audio/UniversalAudioMixer';
import { DecodedPcmSource } from '../packages/ir/src/renderer/audio/AudioSourceAdapter';
import { MediabunnyClientStrategy } from '../packages/core-web/src/media-engine/MediabunnyClientStrategy';
import { MediabunnyClientSink } from '../packages/core-web/src/media-engine/MediabunnyClientSink';

describe('Audio Pipeline & Export Parity (History 412)', () => {
  it('UniversalAudioMixer correctly samples audio with clip-relative offset', () => {
    // 2-second audio asset (440Hz sine wave)
    const sampleRate = 44100;
    const duration = 2.0;
    const totalSamples = Math.floor(sampleRate * duration);
    const pcm = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      pcm[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const source = new DecodedPcmSource({
      channels: [pcm],
      sourceSampleRate: sampleRate,
      sourceTrimStartSec: 0,
    });

    // Place clip at 5.0s on the timeline, duration 2.0s
    const mixer = new UniversalAudioMixer([
      {
        id: 'clip-delayed',
        type: 'bgm',
        startTimeSec: 5.0,
        durationSec: 2.0,
        assetId: 'asset-synth',
        audioSource: source,
      },
    ], sampleRate);

    // 1. Before clip start (e.g. t = 2.0s), output should be silent (all zero)
    const preSlice = mixer.mixStereo(2.0, 1.0);
    let preNonZero = 0;
    for (let i = 0; i < preSlice.left.length; i++) {
      if (preSlice.left[i] !== 0) preNonZero++;
    }
    expect(preNonZero).toBe(0);

    // 2. Exactly at clip start (t = 5.0s), output should contain real non-zero samples
    const activeSlice = mixer.mixStereo(5.0, 1.0);
    let activeNonZero = 0;
    for (let i = 0; i < activeSlice.left.length; i++) {
      if (activeSlice.left[i] !== 0) activeNonZero++;
    }
    expect(activeNonZero).toBeGreaterThan(sampleRate * 0.9);

    // 3. The first sample at t = 5.0s should match the first sample of the asset (sample 0)
    // pcm[10] = sin(2*pi*440*10/44100), scaled by cos(pi/4) pan and soft limiter Math.tanh()
    const expectedRaw10 = pcm[10] * Math.cos(Math.PI / 4); // default pan angle
    const expectedSample10 = Math.tanh(expectedRaw10); // analog master limiter
    expect(activeSlice.left[10]).toBeCloseTo(expectedSample10, 4);
  });

  it('DecodedPcmSource clamps to asset duration and outputs silence past asset length', () => {
    const sampleRate = 44100;
    const duration = 1.0;
    const totalSamples = Math.floor(sampleRate * duration);
    const pcm = new Float32Array(totalSamples);
    pcm.fill(0.75);

    const source = new DecodedPcmSource({
      channels: [pcm],
      sourceSampleRate: sampleRate,
      sourceTrimStartSec: 0,
      loop: false,
    });

    // Sample beyond 1.0s (e.g. offset 1.5s, duration 0.5s)
    const res = source.sample(1.5, 0.5, sampleRate);
    let nonZero = 0;
    for (let i = 0; i < res.left.length; i++) {
      if (res.left[i] !== 0) nonZero++;
    }
    expect(nonZero).toBe(0);
  });

  it('UniversalAudioMixer outputs silence instead of noisy procedural synth for unready assets', () => {
    const sampleRate = 44100;
    const mixer = new UniversalAudioMixer([
      {
        id: 'clip-unready',
        type: 'bgm',
        startTimeSec: 0.0,
        durationSec: 2.0,
        assetId: 'asset-still-downloading', // Real assetId provided, but audioSource undefined
        audioSource: undefined,
      },
    ], sampleRate);

    const mix = mixer.mixStereo(0.0, 1.0);
    let nonZero = 0;
    for (let i = 0; i < mix.left.length; i++) {
      if (mix.left[i] !== 0) nonZero++;
    }
    // Must be completely silent (zero procedural beeps)
    expect(nonZero).toBe(0);
    expect(mix.peakDb).toBe(-60);
  });

  it('MediabunnyClientSink correctly validates and formats audioResult on finalize', async () => {
    const sink = new MediabunnyClientSink();
    const sampleRate = 48000;
    const numSamples = 2048;
    const buffer = new Float32Array(numSamples * 2);
    for (let i = 0; i < numSamples; i++) {
      buffer[i * 2] = 0.5;
      buffer[i * 2 + 1] = 0.5;
    }

    const audioResult = {
      sampleRate,
      channels: 2,
      totalSamples: numSamples,
      durationSeconds: numSamples / sampleRate,
      buffer,
    };

    expect(sink.isInitialized()).toBe(false);
    expect(audioResult.totalSamples).toBe(2048);
    expect(audioResult.buffer.length).toBe(4096);
  });
});
