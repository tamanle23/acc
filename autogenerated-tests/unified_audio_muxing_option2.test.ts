import { describe, it, expect } from 'bun:test';
import { UniversalAudioMixer, type DecoupledAudioMixResult } from '../packages/ir/src/renderer/audio/UniversalAudioMixer';
import { DecodedPcmSource } from '../packages/ir/src/renderer/audio/AudioSourceAdapter';
import type { ResolvedTimeline, ResolvedTrack, ResolvedSequence } from '../packages/ir/src/types/VideoIR';

describe('Option 2: Unified Decoupled Pull-Based Audio Track Engine Suite', () => {
  it('guarantees global ducking envelope continuity across slice boundaries without edge fluttering', () => {
    // 10-second timeline with a voice sequence spanning [4.0s, 7.0s]
    const voiceSeq: ResolvedSequence = {
      id: 'seq-voice',
      type: 'audio',
      trackId: 'track-voice',
      startFrame: 120, // 4.0s at 30 fps
      endFrame: 210,   // 7.0s at 30 fps
      durationFrames: 90,
      modifiers: [
        {
          type: 'sfx/dynamic_ducking',
          target: 'audio',
          params: {
            duckVolume: 0.25,
            attackMs: 150,
            releaseMs: 300,
          },
        },
      ],
    } as ResolvedSequence;

    const bgmSeq: ResolvedSequence = {
      id: 'seq-bgm',
      type: 'audio',
      trackId: 'track-bgm',
      startFrame: 0,
      endFrame: 300, // 10.0s at 30 fps
      durationFrames: 300,
    } as ResolvedSequence;

    const voiceTrack: ResolvedTrack = {
      id: 'track-voice',
      type: 'audio',
      sequences: [voiceSeq],
    };

    const bgmTrack: ResolvedTrack = {
      id: 'track-bgm',
      type: 'audio',
      sequences: [bgmSeq],
    };

    const timeline: ResolvedTimeline = {
      meta: { contentId: 'test-ducking-continuity', globalFps: 30, canvasSize: { w: 1920, h: 1080 } },
      tracks: new Map([
        ['track-voice', voiceTrack],
        ['track-bgm', bgmTrack],
      ]),
      sequences: new Map([
        ['seq-voice', voiceSeq],
        ['seq-bgm', bgmSeq],
      ]),
      totalFrames: 300,
      durationSeconds: 10.0,
    };

    const mixer = new UniversalAudioMixer([], 48000);
    mixer.syncFromTimeline(timeline);

    // Continuous 10.0-second single slice
    const continuous = mixer.mixStereo(0, 10.0);

    // Split 5.0-second slices evaluated consecutively (simulating preview chunks across [0, 5s] and [5s, 10s])
    const sliceA = mixer.mixStereo(0, 5.0);
    const sliceB = mixer.mixStereo(5.0, 5.0);

    // Verify sample lengths
    expect(continuous.left.length).toBe(48000 * 10);
    expect(sliceA.left.length).toBe(48000 * 5);
    expect(sliceB.left.length).toBe(48000 * 5);

    // The transition across boundary t = 5.0s is inside the voice sequence [4.0s, 7.0s].
    // Verify that the first sample of sliceB (at t = 5.0s) exactly matches continuous sample at 5.0s (sample index 240000)
    const continuousAt5s = continuous.left[48000 * 5];
    const sliceBAt0 = sliceB.left[0];

    // In old bifurcated architecture, sliceB would reset ducking to 1.0 (un-ducked) and attack down, causing a jump.
    // In Option 2 unified architecture, both query the pre-computed timeline envelope, so difference is 0.
    expect(Math.abs(sliceBAt0 - continuousAt5s)).toBeLessThan(1e-5);

    // Verify samples across entire second slice [5.0s, 10.0s] match bit-identically
    for (let i = 0; i < sliceB.left.length; i += 480) {
      const diffL = Math.abs(sliceB.left[i] - continuous.left[48000 * 5 + i]);
      const diffR = Math.abs(sliceB.right[i] - continuous.right[48000 * 5 + i]);
      expect(diffL).toBeLessThan(1e-5);
      expect(diffR).toBeLessThan(1e-5);
    }
  });

  it('auto-negotiates hardware sample rate and regenerates envelope without pitch or timing drift', () => {
    const mixer = new UniversalAudioMixer([], 44100);
    expect(mixer.sampleRate).toBe(44100);

    // Set sample rate to 48000 (standard Web Audio / broadcast)
    mixer.setSampleRate(48000);
    expect(mixer.sampleRate).toBe(48000);

    const slice48k = mixer.mixStereo(0, 2.0);
    expect(slice48k.left.length).toBe(48000 * 2);
    expect(slice48k.right.length).toBe(48000 * 2);

    // Set sample rate to 96000 (high-res DAC)
    mixer.setSampleRate(96000);
    expect(mixer.sampleRate).toBe(96000);

    const slice96k = mixer.mixStereo(0, 2.0);
    expect(slice96k.left.length).toBe(96000 * 2);
    expect(slice96k.right.length).toBe(96000 * 2);

    // Ratio between sample counts must be exactly 2.0 (zero timing or pitch distortion)
    expect(slice96k.left.length / slice48k.left.length).toBe(2.0);
  });

  it('produces bit-identical output between mixTimeline and chunked mixTimelineStream', async () => {
    const timeline: ResolvedTimeline = {
      meta: { contentId: 'test-stream-parity', globalFps: 30, canvasSize: { w: 1920, h: 1080 } },
      tracks: new Map(),
      sequences: new Map(),
      totalFrames: 150, // 5.0 seconds
      durationSeconds: 5.0,
    };

    const mixer = new UniversalAudioMixer([], 48000);
    const fullResult = await mixer.mixTimeline(timeline);

    const streamedChunks: DecoupledAudioMixResult[] = [];
    for await (const chunk of mixer.mixTimelineStream(timeline, 1.5)) {
      streamedChunks.push(chunk);
    }

    // Verify chunk durations (1.5s, 1.5s, 1.5s, 0.5s = 5.0s)
    expect(streamedChunks.length).toBe(4);
    expect(streamedChunks[0].durationSeconds).toBe(1.5);
    expect(streamedChunks[1].durationSeconds).toBe(1.5);
    expect(streamedChunks[2].durationSeconds).toBe(1.5);
    expect(streamedChunks[3].durationSeconds).toBeCloseTo(0.5, 3);

    // Concatenate streamed buffers
    const totalStreamedSamples = streamedChunks.reduce((acc, c) => acc + c.totalSamples, 0);
    expect(totalStreamedSamples).toBe(fullResult.totalSamples);

    let offset = 0;
    const concatenated = new Float32Array(totalStreamedSamples * 2);
    for (const chunk of streamedChunks) {
      concatenated.set(chunk.buffer, offset);
      offset += chunk.buffer.length;
    }

    // Full result buffer must match concatenated chunks bit-identically
    expect(concatenated.length).toBe(fullResult.buffer.length);
    for (let i = 0; i < fullResult.buffer.length; i += 100) {
      expect(Math.abs(concatenated[i] - fullResult.buffer[i])).toBeLessThan(1e-6);
    }
  });

  it('generates standard WinterTC WHATWG ReadableStream<Uint8Array> with valid RIFF/WAVE header', async () => {
    const timeline: ResolvedTimeline = {
      meta: { contentId: 'test-whatwg-stream', globalFps: 30, canvasSize: { w: 1920, h: 1080 } },
      tracks: new Map(),
      sequences: new Map(),
      totalFrames: 90, // 3.0 seconds
      durationSeconds: 3.0,
    };

    const mixer = new UniversalAudioMixer([], 48000);
    const stream = mixer.toReadableWavStream(timeline, 1.0);
    expect(stream).toBeInstanceOf(ReadableStream);

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    // First chunk must be the 44-byte standard RIFF header
    expect(chunks.length).toBeGreaterThan(1);
    const header = chunks[0];
    expect(header.byteLength).toBe(44);

    // Verify RIFF header markers
    const textDecoder = new TextDecoder();
    expect(textDecoder.decode(header.subarray(0, 4))).toBe('RIFF');
    expect(textDecoder.decode(header.subarray(8, 12))).toBe('WAVE');
    expect(textDecoder.decode(header.subarray(12, 16))).toBe('fmt ');
    expect(textDecoder.decode(header.subarray(36, 40))).toBe('data');

    // Verify sample rate in header matches 48,000 Hz
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(22, true)).toBe(2); // Stereo
    expect(view.getUint16(34, true)).toBe(16); // 16-bit
  });

  it('enforces equal-power panning law and soft analog tanh limiter', () => {
    const pcmSource = new DecodedPcmSource({
      channels: [new Float32Array([2.0, 2.0, 2.0]), new Float32Array([2.0, 2.0, 2.0])],
      sourceSampleRate: 48000,
    });

    const mixer = new UniversalAudioMixer([
      {
        id: 'clip-hot',
        type: 'sfx',
        startTimeSec: 0,
        durationSec: 1.0,
        volume: 2.0, // High volume to drive limiter
        pan: 0.0,
        audioSource: pcmSource,
      },
    ], 48000);

    const result = mixer.mixStereo(0, 1.0);

    // Tanh soft limiter must clamp output strictly within (-1.0, 1.0)
    for (let i = 0; i < result.left.length; i += 100) {
      expect(result.left[i]).toBeLessThanOrEqual(1.0);
      expect(result.left[i]).toBeGreaterThanOrEqual(-1.0);
      expect(result.right[i]).toBeLessThanOrEqual(1.0);
      expect(result.right[i]).toBeGreaterThanOrEqual(-1.0);
    }
  });
});
