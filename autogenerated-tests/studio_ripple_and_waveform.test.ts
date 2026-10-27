import { describe, it, expect, beforeEach } from 'bun:test';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { RippleTrimSequenceCommand } from '../apps/studio/src/lib/commands/RippleTrimSequenceCommand';
import { RippleDeleteSequenceCommand } from '../apps/studio/src/lib/commands/RippleDeleteSequenceCommand';
import { computePeaksFromPcm, generateProceduralEnvelope } from '../apps/studio/src/lib/audio/audioWaveform.worker';
import type { VideoIRDocument } from '@acc/ir';

function createMockDoc(): VideoIRDocument {
  return {
    version: '1.0.0-stable',
    meta: {
      contentId: 'ripple-test',
      globalFps: 30,
      canvasSize: { w: 1920, h: 1080 },
      colorSpace: 'srgb',
    },
    assets: {
      'asset-v1': { src: 'test1.mp4', type: 'media' },
      'asset-v2': { src: 'test2.mp4', type: 'media' },
      'asset-v3': { src: 'test3.mp4', type: 'media' },
      'asset-a1': { src: 'test_audio.mp3', type: 'audio' },
    },
    tracks: [
      {
        id: 'track-v1',
        name: 'Video 1',
        type: 'video',
        sequences: [
          {
            id: 'seq-1',
            type: 'video',
            assetId: 'asset-v1',
            time: { start: 0, duration: 60 },
          },
          {
            id: 'seq-2',
            type: 'video',
            assetId: 'asset-v2',
            time: { start: 60, duration: 60 },
          },
          {
            id: 'seq-3',
            type: 'video',
            assetId: 'asset-v3',
            time: { start: 120, duration: 90 },
          },
        ],
      },
      {
        id: 'track-a1',
        name: 'Audio 1',
        type: 'audio',
        sequences: [
          {
            id: 'seq-a1',
            type: 'audio',
            assetId: 'asset-a1',
            time: { start: 0, duration: 180 },
          },
        ],
      },
    ],
  };
}

describe('Pillar 2: Audio Waveform Worker Peak Extraction', () => {
  it('computes peaks accurately from PCM Float32Array channel data', () => {
    const channel = new Float32Array(1000);
    channel[500] = 0.85;
    const targetBars = 10;
    const peaks = computePeaksFromPcm(channel, targetBars);

    expect(peaks.length).toBe(targetBars);
    expect(peaks[5]).toBeCloseTo(0.85, 2);
    expect(peaks[0]).toBeGreaterThanOrEqual(0.05);
  });

  it('interpolates properly if targetBars exceeds channel length', () => {
    const channel = new Float32Array([0.2, 0.4, 0.8]);
    const targetBars = 5;
    const peaks = computePeaksFromPcm(channel, targetBars);
    expect(peaks.length).toBe(5);
    expect(peaks[0]).toBeGreaterThanOrEqual(0.05);
  });

  it('generates deterministic procedural envelope fallback', () => {
    const env1 = generateProceduralEnvelope('audio-clip-1', 40);
    const env2 = generateProceduralEnvelope('audio-clip-1', 40);
    expect(env1.length).toBe(40);
    expect(env2.length).toBe(40);
    for (let i = 0; i < 40; i++) {
      expect(env1[i]).toBe(env2[i]);
    }
  });
});

describe('Pillar 2: Track-Scoped Ripple Editing & History Operations', () => {
  beforeEach(() => {
    const manager = IRStateManager.getInstance();
    manager.loadFromJSON(JSON.stringify(createMockDoc()));
  });

  it('executes track-scoped ripple tail trim and downstream shift correctly', () => {
    const manager = IRStateManager.getInstance();
    // Trim seq-2 duration from 60 to 90 (+30 frames)
    manager.rippleTrimSequence('seq-2', 0, 30);

    const doc = manager.getState().doc;
    const v1Track = doc.tracks.find((t) => t.id === 'track-v1');
    const a1Track = doc.tracks.find((t) => t.id === 'track-a1');

    const s2 = v1Track?.sequences.find((s) => s.id === 'seq-2');
    const s3 = v1Track?.sequences.find((s) => s.id === 'seq-3');
    const sa1 = a1Track?.sequences.find((s) => s.id === 'seq-a1');

    // seq-2 should be extended to duration 90
    expect(s2?.time.duration).toBe(90);
    // seq-3 (downstream on track-v1) should be shifted downstream by 30 frames: from 120 to 150
    expect(s3?.time.start).toBe(150);
    // Audio track A1 should NOT be touched (track-scoped)
    expect(sa1?.time.start).toBe(0);
    expect(sa1?.time.duration).toBe(180);
  });

  it('undoes and redoes rippleTrimSequence flawlessly', () => {
    const manager = IRStateManager.getInstance();
    // Trim seq-2 tail: +20 frames
    manager.rippleTrimSequence('seq-2', 0, 20);

    let doc = manager.getState().doc;
    let s3 = doc.tracks[0].sequences.find((s) => s.id === 'seq-3');
    expect(s3?.time.start).toBe(140);

    // Undo
    manager.undo();
    doc = manager.getState().doc;
    s3 = doc.tracks[0].sequences.find((s) => s.id === 'seq-3');
    let s2 = doc.tracks[0].sequences.find((s) => s.id === 'seq-2');
    expect(s2?.time.duration).toBe(60);
    expect(s3?.time.start).toBe(120);

    // Redo
    manager.redo();
    doc = manager.getState().doc;
    s3 = doc.tracks[0].sequences.find((s) => s.id === 'seq-3');
    s2 = doc.tracks[0].sequences.find((s) => s.id === 'seq-2');
    expect(s2?.time.duration).toBe(80);
    expect(s3?.time.start).toBe(140);
  });

  it('executes track-scoped ripple delete and closes gap cleanly', () => {
    const manager = IRStateManager.getInstance();
    // Delete seq-2 (start: 60, duration: 60). Downstream seq-3 should shift back by 60 frames: 120 -> 60.
    manager.rippleDeleteSequence('seq-2');

    const doc = manager.getState().doc;
    const v1Track = doc.tracks.find((t) => t.id === 'track-v1');
    const seqs = v1Track?.sequences || [];

    expect(seqs.length).toBe(2);
    expect(seqs.find((s) => s.id === 'seq-2')).toBeUndefined();

    const s3 = seqs.find((s) => s.id === 'seq-3');
    expect(s3).toBeDefined();
    // Gap closed: seq-3 moves from frame 120 to frame 60
    expect(s3?.time.start).toBe(60);

    // Undo restoration
    manager.undo();
    const undoneDoc = manager.getState().doc;
    const undoneTrack = undoneDoc.tracks.find((t) => t.id === 'track-v1');
    expect(undoneTrack?.sequences.length).toBe(3);
    const restoredS2 = undoneTrack?.sequences.find((s) => s.id === 'seq-2');
    const restoredS3 = undoneTrack?.sequences.find((s) => s.id === 'seq-3');
    expect(restoredS2).toBeDefined();
    expect(restoredS2?.time.start).toBe(60);
    expect(restoredS3?.time.start).toBe(120);
  });
});
