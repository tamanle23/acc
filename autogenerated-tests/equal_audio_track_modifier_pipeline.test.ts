import { describe, it, expect } from 'bun:test';
import { UniversalAudioMixer, type DecodedAudioPCM } from '../packages/ir/src/renderer/audio/UniversalAudioMixer';
import type { ResolvedTimeline, ResolvedTrack, ResolvedSequence } from '../packages/ir/src/types/VideoIR';

describe('UniversalAudioMixer Equal Track Architecture with Dynamic Sidechain Ducking', () => {
  it('treats all tracks equally without ad hoc track id/name heuristics', async () => {
    // Arbitrary track IDs that don't contain 'voice', 'bgm', 'a1', 'a2', or 'a4'
    const narratorTrack: ResolvedTrack = {
      id: 'track-dialogue-lead',
      type: 'audio',
      sequences: [
        {
          id: 'seq-speech-1',
          type: 'audio',
          trackId: 'track-dialogue-lead',
          startFrame: 30, // 1.0s to 3.0s
          endFrame: 90,
          durationFrames: 60,
          modifiers: [
            {
              type: 'sfx/dynamic_ducking',
              target: 'audio',
              params: {
                targetBus: 'track-soundbed-heavy',
                duckVolume: 0.1,
                attackMs: 15,
                releaseMs: 100,
              },
            },
          ],
        } as ResolvedSequence,
      ],
    };

    const bedTrack: ResolvedTrack = {
      id: 'track-soundbed-heavy',
      type: 'audio',
      sequences: [
        {
          id: 'seq-bed-1',
          type: 'audio',
          trackId: 'track-soundbed-heavy',
          startFrame: 0,
          endFrame: 150, // 5.0s
          durationFrames: 150,
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.5,
              },
            },
          ],
        } as ResolvedSequence,
      ],
    };

    const timeline: ResolvedTimeline = {
      meta: {
        contentId: 'test-ducking-equal-tracks',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: new Map([
        ['track-dialogue-lead', narratorTrack],
        ['track-soundbed-heavy', bedTrack],
      ]),
      sequences: new Map([
        ['seq-speech-1', narratorTrack.sequences[0]],
        ['seq-bed-1', bedTrack.sequences[0]],
      ]),
      totalFrames: 150,
      durationSeconds: 5.0,
    };

    const mixer = new UniversalAudioMixer([], 48000);

    // Mock decodeAsset on mixer to return synthetic PCM
    const sampleRate = 48000;
    const speechSamples = 2 * sampleRate; // 2 seconds
    const speechData = new Float32Array(speechSamples * 2);
    for (let i = 0; i < speechSamples; i++) {
      speechData[i * 2] = 0.8; // Left
      speechData[i * 2 + 1] = 0.8; // Right
    }

    const bedSamples = 5 * sampleRate; // 5 seconds
    const bedData = new Float32Array(bedSamples * 2);
    for (let i = 0; i < bedSamples; i++) {
      bedData[i * 2] = 0.5;
      bedData[i * 2 + 1] = 0.5;
    }

    mixer.decodeAsset = async (path: string): Promise<DecodedAudioPCM | null> => {
      if (path.includes('speech')) {
        return {
          sampleRate,
          channels: 2,
          totalSamplesPerChannel: speechSamples,
          durationSeconds: 2.0,
          data: speechData,
        };
      }
      return {
        sampleRate,
        channels: 2,
        totalSamplesPerChannel: bedSamples,
        durationSeconds: 5.0,
        data: bedData,
      };
    };

    // Assign mock asset definitions to timeline
    timeline.assets = {
      'asset-speech': { src: 'speech.wav', type: 'audio' },
      'asset-bed': { src: 'bed.wav', type: 'audio' },
    };
    narratorTrack.sequences[0].assetId = 'asset-speech';
    bedTrack.sequences[0].assetId = 'asset-bed';

    const result = await mixer.mixTimeline(timeline);

    expect(result.totalSamples).toBe(5 * sampleRate);
    expect(result.channels).toBe(2);
    expect(result.buffer.length).toBe(5 * sampleRate * 2);

    // Verify bed track audio before speech (at 1.0s = sample 48000, after 1.5s fade-in at 24000 it is in ramp)
    // At sample 0.75s (36000), sin(PI * 0.75 / 3.0) = sin(PI/4) = 0.707 * 0.5 * 0.707 = 0.25
    const rampIdx = Math.round(0.75 * sampleRate) * 2;
    const rampLevel = Math.abs(result.buffer[rampIdx]);
    expect(rampLevel).toBeGreaterThan(0.05);

    // Verify during speech (at 2.0s = sample 96000), speech is active (level close to speech + ducked bed)
    const activeSpeechIdx = Math.round(2.0 * sampleRate) * 2;
    const activeLevel = Math.abs(result.buffer[activeSpeechIdx]);
    expect(activeLevel).toBeGreaterThan(0.5); // Speech is 0.8

    // Verify after speech finishes (at 3.5s = sample 168000), bed has recovered
    const recoveredIdx = Math.round(3.5 * sampleRate) * 2;
    const recoveredLevel = Math.abs(result.buffer[recoveredIdx]);
    expect(recoveredLevel).toBeGreaterThan(0.05);
  });
});
