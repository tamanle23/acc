import { describe, it, expect, beforeEach } from 'bun:test';
import {
  IRMasterRenderer,
  UniversalAudioMixer,
  type ResolvedTimeline,
} from '@acc/ir';
import { IRPreviewEngine } from '@acc/studio';

describe('IRPreviewEngine and IRMasterRenderer Audio-Visual Parity Suite', () => {
  let mockTimeline: ResolvedTimeline;

  beforeEach(() => {
    mockTimeline = {
      meta: {
        canvasSize: { w: 1920, h: 1080 },
        globalFps: 30,
      },
      totalFrames: 300,
      tracks: new Map([
        [
          'track-v1',
          {
            id: 'track-v1',
            type: 'video',
            sequences: [
              {
                id: 'seq-v1',
                name: 'Background Video',
                startFrame: 0,
                durationFrames: 150,
                assetId: 'asset-video-1',
              },
            ],
          } as any,
        ],
        [
          'track-a1',
          {
            id: 'track-a1',
            type: 'audio',
            sequences: [
              {
                id: 'seq-voiceover',
                name: 'Pilot Voice Dialogue',
                startFrame: 30,
                durationFrames: 90,
                assetId: 'asset-voice',
              },
            ],
          } as any,
        ],
        [
          'track-a2',
          {
            id: 'track-a2',
            type: 'audio',
            sequences: [
              {
                id: 'seq-bgm',
                name: 'Cyberpunk BGM',
                startFrame: 0,
                durationFrames: 300,
                assetId: 'asset-bgm',
              },
            ],
          } as any,
        ],
      ]),
      sequences: new Map(),
    };
  });

  it('encapsulates UniversalAudioMixer inside IRPreviewEngine with synchronized clips', () => {
    const previewEngine = new IRPreviewEngine(mockTimeline);
    const audioMixer = previewEngine.getAudioMixer();

    expect(audioMixer).toBeDefined();
    expect(audioMixer).toBeInstanceOf(UniversalAudioMixer);

    const clips = audioMixer.getClips();
    expect(clips.length).toBe(2);

    const voiceClip = clips.find((c) => c.id === 'seq-voiceover');
    expect(voiceClip).toBeDefined();
    expect(voiceClip?.type).toBe('voice');
    expect(voiceClip?.startTimeSec).toBe(1.0); // 30 frames / 30 fps
    expect(voiceClip?.durationSec).toBe(3.0); // 90 frames / 30 fps

    const bgmClip = clips.find((c) => c.id === 'seq-bgm');
    expect(bgmClip).toBeDefined();
    expect(bgmClip?.type).toBe('bgm');
    expect(bgmClip?.startTimeSec).toBe(0.0);
    expect(bgmClip?.durationSec).toBe(10.0); // 300 frames / 30 fps
  });

  it('generates consistent audio output between IRPreviewEngine and IRMasterRenderer audio mixer', () => {
    // Provide deterministic custom synthesizer to test sample parity without Math.random analog drift
    const synthDeterministic = (t: number, d: number, sr: number) => {
      const len = Math.floor(d * sr);
      const out = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        out[i] = Math.sin(2 * Math.PI * 440 * (t + i / sr)) * 0.5;
      }
      return out;
    };

    const deterministicTimeline: ResolvedTimeline = {
      ...mockTimeline,
      tracks: new Map([
        [
          'track-a1',
          {
            id: 'track-a1',
            type: 'audio',
            sequences: [
              {
                id: 'seq-voiceover',
                name: 'Deterministic Voice',
                startFrame: 30,
                durationFrames: 90,
              },
            ],
          } as any,
        ],
      ]),
    };

    const previewEngine = new IRPreviewEngine(deterministicTimeline);
    const masterRenderer = new IRMasterRenderer(deterministicTimeline);

    const previewMixer = previewEngine.getAudioMixer();
    const masterMixer = (masterRenderer as any).audioMixer as UniversalAudioMixer;
    masterMixer.syncFromTimeline(deterministicTimeline);

    // Override clips with deterministic synthesizer
    previewMixer.getClips()[0].customSynthesizer = synthDeterministic;
    masterMixer.getClips()[0].customSynthesizer = synthDeterministic;

    // Mix 3.0-second slice starting at 1.0s
    const previewResult = previewEngine.renderAudioSlice(1.0, 3.0);
    const masterResult = masterMixer.mixStereo(1.0, 3.0);

    expect(previewResult.left.length).toBe(masterResult.left.length);
    expect(previewResult.right.length).toBe(masterResult.right.length);

    // Bit-identical floating-point check
    let maxDiffL = 0;
    let maxDiffR = 0;
    for (let i = 0; i < previewResult.left.length; i++) {
      const diffL = Math.abs(previewResult.left[i] - masterResult.left[i]);
      const diffR = Math.abs(previewResult.right[i] - masterResult.right[i]);
      if (diffL > maxDiffL) maxDiffL = diffL;
      if (diffR > maxDiffR) maxDiffR = diffR;
    }

    expect(maxDiffL).toBe(0);
    expect(maxDiffR).toBe(0);
    expect(previewResult.peakDb).toBe(masterResult.peakDb);
  });

  it('dynamically resynchronizes audio mixer when syncTimeline() is called', () => {
    const previewEngine = new IRPreviewEngine(mockTimeline);
    expect(previewEngine.getAudioMixer().getClips().length).toBe(2);

    // Add SFX track
    const updatedTimeline: ResolvedTimeline = {
      ...mockTimeline,
      tracks: new Map([
        ...mockTimeline.tracks.entries(),
        [
          'track-a3',
          {
            id: 'track-a3',
            type: 'audio',
            sequences: [
              {
                id: 'seq-sfx-laser',
                name: 'Laser Blast SFX',
                startFrame: 60,
                durationFrames: 30,
              },
            ],
          } as any,
        ],
      ]),
    };

    previewEngine.syncTimeline(updatedTimeline);
    const clips = previewEngine.getAudioMixer().getClips();
    expect(clips.length).toBe(3);

    const sfxClip = clips.find((c) => c.id === 'seq-sfx-laser');
    expect(sfxClip).toBeDefined();
    expect(sfxClip?.type).toBe('sfx');
  });
});
