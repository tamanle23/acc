import { describe, it, expect } from 'bun:test';
import type { VideoIRDocument, ResolvedTimeline, ResolvedTrack } from '../packages/ir/src/types/VideoIR';
import { RelationalDAGCompiler } from '../packages/ir/src/compiler/RelationalDAGCompiler';
import { UniversalAudioMixer } from '../packages/ir/src/renderer/audio/UniversalAudioMixer';

describe('Track Bus Compilation & Mixing Suite', () => {
  it('RelationalDAGCompiler preserves muted, visible, locked, and style properties on ResolvedTrack', () => {
    const doc: VideoIRDocument = {
      version: '1.0.0',
      meta: { title: 'Track Properties Test', globalFps: 30 },
      tracks: [
        {
          id: 'track-v1',
          name: 'Video 1',
          type: 'video',
          visible: false,
          locked: true,
          style: { opacity: 0.75, blendMode: 'screen' },
          sequences: [
            { id: 'seq-1', type: 'video', time: { start: 0, duration: 60 } },
          ],
        },
        {
          id: 'track-a1',
          name: 'Audio 1',
          type: 'audio',
          muted: true,
          locked: false,
          style: { volume: 0.5, pan: -0.2 },
          sequences: [
            { id: 'seq-2', type: 'audio', time: { start: 0, duration: 90 } },
          ],
        },
      ],
    };

    const compiler = new RelationalDAGCompiler();
    const timeline = compiler.compile(doc);

    const vTrack = timeline.tracks.get('track-v1');
    expect(vTrack).toBeDefined();
    expect(vTrack?.visible).toBe(false);
    expect(vTrack?.locked).toBe(true);
    expect(vTrack?.style?.opacity).toBe(0.75);
    expect(vTrack?.style?.blendMode).toBe('screen');

    const aTrack = timeline.tracks.get('track-a1');
    expect(aTrack).toBeDefined();
    expect(aTrack?.muted).toBe(true);
    expect(aTrack?.locked).toBe(false);
    expect(aTrack?.style?.volume).toBe(0.5);
    expect(aTrack?.style?.pan).toBe(-0.2);
  });

  it('UniversalAudioMixer skips sequences on muted tracks and applies volume/pan styling', () => {
    const tracksMap = new Map<string, ResolvedTrack>();

    tracksMap.set('track-unmuted', {
      id: 'track-unmuted',
      name: 'Unmuted Track',
      type: 'audio',
      muted: false,
      style: { volume: 0.5, pan: 0.2 },
      sequences: [
        {
          id: 'seq-active',
          type: 'audio',
          startFrame: 0,
          durationFrames: 60,
          endFrame: 60,
          modifiers: [
            { type: 'audio/volume', target: 'audio', params: { volume: 1.0 } },
          ],
        } as any,
      ],
    } as any);

    tracksMap.set('track-muted', {
      id: 'track-muted',
      name: 'Muted Track',
      type: 'audio',
      muted: true,
      style: { volume: 1.0 },
      sequences: [
        {
          id: 'seq-muted',
          type: 'audio',
          startFrame: 0,
          durationFrames: 60,
          endFrame: 60,
        } as any,
      ],
    } as any);

    const mockTimeline: ResolvedTimeline = {
      meta: { globalFps: 30, canvasSize: { w: 1920, h: 1080 } },
      totalFrames: 120,
      tracks: tracksMap,
      sequences: new Map(),
    };

    const mixer = new UniversalAudioMixer([], 44100);
    mixer.syncFromTimeline(mockTimeline);

    const clips = mixer.getClips();
    // Only unmuted sequence should be included
    expect(clips.length).toBe(1);
    expect(clips[0].id).toBe('seq-active');

    // Volume should be clipVolume (1.0) * trackVolume (0.5) = 0.5
    expect(clips[0].volume).toBeCloseTo(0.5, 3);
    // Pan should be clipPan (0.0) + trackPan (0.2) = 0.2
    expect(clips[0].pan).toBeCloseTo(0.2, 3);
  });
});
