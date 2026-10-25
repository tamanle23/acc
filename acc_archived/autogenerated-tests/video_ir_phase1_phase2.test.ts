import { describe, it, expect } from 'bun:test';
import {
  VideoIRSchemaValidator,
  StoryConfigToUniversalIRAdapter,
  RelationalDAGCompiler,
  DeterministicAudioClock,
  IntervalTreeIndex,
  type VideoIRDocument,
  type LegacyStoryConfig,
} from '../packages/ir/src';

describe('Video IR Phase 1 & Phase 2: Schema, Adapter & Deterministic DAG Compiler', () => {
  it('validates a correct Video IR V1.0-Stable document', () => {
    const validDoc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'test_doc_01',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      assets: {
        raw_vid: { src: 'assets/clip.mp4', type: 'media' },
      },
      tracks: [
        {
          id: 'track_v1',
          type: 'video',
          modifiers: [
            {
              type: 'color/lut',
              target: 'video',
              params: { lutAsset: 'rec709', intensity: 1.0 },
            },
          ],
          sequences: [
            {
              id: 'seq_1',
              type: 'video',
              assetId: 'raw_vid',
              time: { start: 0, duration: 90 },
            },
          ],
        },
      ],
    };

    const res = VideoIRSchemaValidator.validate(validDoc);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('rejects invalid IR documents missing version or malformed modifiers', () => {
    const invalidDoc = {
      meta: { globalFps: -5 },
      tracks: [
        {
          id: 'v1',
          type: 'unknown_type',
          modifiers: [{ type: 'bad_modifier' }], // missing params
          sequences: [],
        },
      ],
    };

    const res = VideoIRSchemaValidator.validate(invalidDoc);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('Invalid version'))).toBe(true);
    expect(res.errors.some(e => e.includes('missing "params"'))).toBe(true);
  });

  it('adapts a LegacyStoryConfig into a valid VideoIR document (Pioneer Flywheel)', () => {
    const legacyStory: LegacyStoryConfig = {
      name: 'Pioneer_Story_Test',
      settings: {
        width: 1920,
        height: 1080,
        fps: 30,
        bgm: {
          source: 'assets/bgm.mp3',
          autoDucking: true,
        },
      },
      scenes: [
        {
          image: 'assets/scene1.jpg',
          audio: 'assets/voice1.wav',
          duration: 4.0,
          captions: [
            { start: 0.2, end: 1.5, text: 'Hello world' },
            { start: 1.6, end: 3.8, text: 'Welcome to Video IR' },
          ],
          transition: { enabled: true, duration: 1.0 },
          depth3d: { enabled: true, mode: 'frame_breaker' },
        },
        {
          image: 'assets/scene2.jpg',
          audio: 'assets/voice2.wav',
          duration: 3.0,
        },
      ],
    };

    const irDoc = StoryConfigToUniversalIRAdapter.adapt(legacyStory);
    const validation = VideoIRSchemaValidator.validate(irDoc);

    expect(validation.valid).toBe(true);
    expect(irDoc.tracks.length).toBe(4); // video, voiceover, captions, bgm

    const vTrack = irDoc.tracks.find(t => t.id === 'track_v1_main')!;
    expect(vTrack.sequences.length).toBe(2);
    expect(vTrack.sequences[0].modifiers?.[0].type).toBe('vfx/depth3d');

    const capTrack = irDoc.tracks.find(t => t.id === 'track_captions')!;
    expect(capTrack.sequences[0].cues?.length).toBe(2);
    expect(capTrack.sequences[0].cues?.[0].startOffsetMs).toBe(200);

    const bgmTrack = irDoc.tracks.find(t => t.id === 'track_a2_bgm')!;
    expect(bgmTrack.modifiers?.[0].type).toBe('sfx/dynamic_ducking');
  });

  it('compiles relational time constraints into an absolute frame timeline', async () => {
    const irDoc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'relational_test',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track_audio_anchor',
          type: 'audio',
          sequences: [
            {
              id: 'seq_audio_1',
              type: 'audio',
              time: { start: 0, duration: 90 }, // 3.0 seconds
            },
            {
              id: 'seq_audio_2',
              type: 'audio',
              time: { start: { after: 'seq_audio_1' }, duration: 60 }, // 2.0 seconds
            },
          ],
        },
        {
          id: 'track_video_subordinate',
          type: 'video',
          sequences: [
            {
              id: 'seq_video_1',
              type: 'video',
              time: {
                start: { syncWith: 'seq_audio_1', offsetFrames: 5 },
                duration: { matchLengthOf: 'seq_audio_1', paddingFrames: 10 },
              },
            },
            {
              id: 'seq_video_2',
              type: 'video',
              time: {
                start: { after: 'seq_video_1', overlapFrames: 15 },
                duration: { matchLengthOf: 'seq_audio_2' },
              },
            },
          ],
        },
      ],
    };

    const compiler = new RelationalDAGCompiler();
    const timeline = await compiler.compile(irDoc);

    const sVid1 = timeline.sequences.get('seq_video_1')!;
    expect(sVid1.startFrame).toBe(5); // synced with seq_audio_1 (0) + 5
    expect(sVid1.durationFrames).toBe(100); // 90 + 10 padding
    expect(sVid1.endFrame).toBe(105);

    const sVid2 = timeline.sequences.get('seq_video_2')!;
    expect(sVid2.startFrame).toBe(90); // after seq_video_1 (end 105) - 15 overlap
    expect(sVid2.durationFrames).toBe(60); // matchLengthOf seq_audio_2
    expect(sVid2.endFrame).toBe(150);

    expect(timeline.totalFrames).toBe(150);
    expect(timeline.durationSeconds).toBe(5.0);
  });

  it('detects cycles in relational timeline and throws descriptive deadlock error', async () => {
    const cyclicalDoc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'cycle_test',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track_v1',
          type: 'video',
          sequences: [
            {
              id: 'seq_A',
              type: 'video',
              time: { start: { after: 'seq_B' }, duration: 30 },
            },
            {
              id: 'seq_B',
              type: 'video',
              time: { start: { after: 'seq_A' }, duration: 30 },
            },
          ],
        },
      ],
    };

    const compiler = new RelationalDAGCompiler();
    expect(compiler.compile(cyclicalDoc)).rejects.toThrow('Cycle detected in sequence start timing graph');
  });

  it('verifies DeterministicAudioClock sample precision across 100,000 frames', () => {
    const fps = 29.97; // Non-integer NTSC
    const sampleRate = 48000;

    let accumulatedSamples = 0;
    for (let f = 0; f < 1000; f++) {
      const bounds = DeterministicAudioClock.getAudioBoundsForFrame(f, sampleRate, fps);
      expect(bounds.startSample).toBe(accumulatedSamples);
      accumulatedSamples += bounds.sampleCount;
    }

    const expectedTotal = DeterministicAudioClock.totalSamplesForFrames(1000, sampleRate, fps);
    expect(accumulatedSamples).toBe(expectedTotal);
  });

  it('verifies IntervalTreeIndex performs O(log M) playhead intersection queries', () => {
    const seqs = [
      { id: 's1', trackId: 'v1', startFrame: 0, endFrame: 50, durationFrames: 50 },
      { id: 's2', trackId: 'v1', startFrame: 40, endFrame: 100, durationFrames: 60 },
      { id: 's3', trackId: 'v2', startFrame: 80, endFrame: 150, durationFrames: 70 },
    ];

    const tree = new IntervalTreeIndex(seqs);

    // Frame 45 should intersect with s1 and s2
    const activeAt45 = tree.queryActive(45);
    expect(activeAt45.map(s => s.id).sort()).toEqual(['s1', 's2']);

    // Frame 90 should intersect with s2 and s3
    const activeAt90 = tree.queryActive(90);
    expect(activeAt90.map(s => s.id).sort()).toEqual(['s2', 's3']);

    // Frame 200 should intersect with nothing
    const activeAt200 = tree.queryActive(200);
    expect(activeAt200.length).toBe(0);
  });
});
