import { describe, test, expect, beforeEach } from 'bun:test';
import { VideoIRSchemaValidator } from '../packages/ir/src/schema/VideoIRSchemaValidator';
import { AddLinkedAVSequenceCommand } from '../apps/studio/src/lib/commands/AddLinkedAVSequenceCommand';
import { MoveSequenceCommand } from '../apps/studio/src/lib/commands/MoveSequenceCommand';
import { TrimSequenceCommand } from '../apps/studio/src/lib/commands/TrimSequenceCommand';
import type { VideoIRDocument, IRSequence } from '../packages/ir/src/types/VideoIR';

function createMockIRDocument(): VideoIRDocument {
  return {
    version: '1.0.0-stable',
    meta: {
      contentId: 'test-av-split',
      globalFps: 30,
      canvasSize: { w: 1920, h: 1080 },
    },
    tracks: [
      {
        id: 'track-v1',
        name: 'Video Track 1',
        type: 'video',
        sequences: [],
      },
      {
        id: 'track-a1',
        name: 'Audio Track 1',
        type: 'audio',
        sequences: [],
      },
    ],
  };
}

describe('Pillar 3: Asset Direct Ingestion & Linked A/V Split Engine', () => {
  let doc: VideoIRDocument;

  beforeEach(() => {
    doc = createMockIRDocument();
  });

  test('Validates editorial/av_link modifier against VideoIRSchemaValidator', () => {
    const videoSeq: IRSequence = {
      id: 'seq-video-1',
      type: 'video',
      time: {
        start: 0,
        duration: 120,
      },
      assetId: 'sample.mp4',
      modifiers: [
        {
          id: 'mod-link-v1',
          type: 'editorial/av_link',
          target: 'video',
          params: {
            linkedSequenceId: 'seq-audio-1',
            linkedTrackId: 'track-a1',
            enabled: true,
            syncTrim: true,
          },
        },
      ],
    };

    doc.tracks[0].sequences.push(videoSeq);

    const validation = VideoIRSchemaValidator.validate(doc);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('AddLinkedAVSequenceCommand atomically adds video and audio sequences and rolls back cleanly on undo', () => {
    const videoSeq: IRSequence = {
      id: 'v_seq_1',
      type: 'video',
      time: { start: 30, duration: 150 },
      assetId: 'interview.mp4',
      modifiers: [
        {
          id: 'link_v',
          type: 'editorial/av_link',
          params: {
            linkedSequenceId: 'a_seq_1',
            linkedTrackId: 'track-a1',
            enabled: true,
            syncTrim: true,
          },
        },
      ],
    };

    const audioSeq: IRSequence = {
      id: 'a_seq_1',
      type: 'audio',
      time: { start: 30, duration: 150 },
      assetId: 'interview.mp4',
      modifiers: [
        {
          id: 'link_a',
          type: 'editorial/av_link',
          params: {
            linkedSequenceId: 'v_seq_1',
            linkedTrackId: 'track-v1',
            enabled: true,
            syncTrim: true,
          },
        },
      ],
    };

    const cmd = new AddLinkedAVSequenceCommand({
      videoSequence: videoSeq,
      audioSequence: audioSeq,
      videoTrackId: 'track-v1',
      audioTrackId: 'track-a1',
    });

    // Execute
    const updated = cmd.execute(doc);
    const vTrack = updated.tracks.find((t) => t.id === 'track-v1')!;
    const aTrack = updated.tracks.find((t) => t.id === 'track-a1')!;

    expect(vTrack.sequences).toHaveLength(1);
    expect(aTrack.sequences).toHaveLength(1);
    expect(vTrack.sequences[0].id).toBe('v_seq_1');
    expect(aTrack.sequences[0].id).toBe('a_seq_1');

    // Undo
    const rolledBack = cmd.undo(updated);
    const rbVTrack = rolledBack.tracks.find((t) => t.id === 'track-v1')!;
    const rbATrack = rolledBack.tracks.find((t) => t.id === 'track-a1')!;

    expect(rbVTrack.sequences).toHaveLength(0);
    expect(rbATrack.sequences).toHaveLength(0);
  });

  test('MoveSequenceCommand shifts both video and audio sequences symmetrically when linked', () => {
    const videoSeq: IRSequence = {
      id: 'v_seq_2',
      type: 'video',
      time: { start: 10, duration: 90 },
      modifiers: [
        {
          id: 'mod_link_v2',
          type: 'editorial/av_link',
          params: {
            linkedSequenceId: 'a_seq_2',
            linkedTrackId: 'track-a1',
            enabled: true,
            syncTrim: true,
          },
        },
      ],
    };

    const audioSeq: IRSequence = {
      id: 'a_seq_2',
      type: 'audio',
      time: { start: 10, duration: 90 },
      modifiers: [
        {
          id: 'mod_link_a2',
          type: 'editorial/av_link',
          params: {
            linkedSequenceId: 'v_seq_2',
            linkedTrackId: 'track-v1',
            enabled: true,
            syncTrim: true,
          },
        },
      ],
    };

    doc.tracks[0].sequences.push(videoSeq);
    doc.tracks[1].sequences.push(audioSeq);

    // Move video from frame 10 to frame 45 (deltaShift = +35)
    const moveCmd = new MoveSequenceCommand('v_seq_2', 'track-v1', 45);
    const movedDoc = moveCmd.execute(doc);

    const movedV = movedDoc.tracks[0].sequences.find((s) => s.id === 'v_seq_2')!;
    const movedA = movedDoc.tracks[1].sequences.find((s) => s.id === 'a_seq_2')!;

    expect(movedV.time.start).toBe(45);
    // Symmetrical linked audio movement:
    expect(movedA.time.start).toBe(45);

    // Undo Move Command
    const undoneDoc = moveCmd.undo(movedDoc);
    const undonV = undoneDoc.tracks[0].sequences.find((s) => s.id === 'v_seq_2')!;
    const undonA = undoneDoc.tracks[1].sequences.find((s) => s.id === 'a_seq_2')!;

    expect(undonV.time.start).toBe(10);
    expect(undonA.time.start).toBe(10);
  });

  test('TrimSequenceCommand trims both video and audio sequences symmetrically when syncTrim is enabled', () => {
    const videoSeq: IRSequence = {
      id: 'v_seq_3',
      type: 'video',
      time: { start: 50, duration: 100 },
      modifiers: [
        {
          id: 'mod_link_v3',
          type: 'editorial/av_link',
          params: {
            linkedSequenceId: 'a_seq_3',
            linkedTrackId: 'track-a1',
            enabled: true,
            syncTrim: true,
          },
        },
      ],
    };

    const audioSeq: IRSequence = {
      id: 'a_seq_3',
      type: 'audio',
      time: { start: 50, duration: 100 },
      modifiers: [
        {
          id: 'mod_link_a3',
          type: 'editorial/av_link',
          params: {
            linkedSequenceId: 'v_seq_3',
            linkedTrackId: 'track-v1',
            enabled: true,
            syncTrim: true,
          },
        },
      ],
    };

    doc.tracks[0].sequences.push(videoSeq);
    doc.tracks[1].sequences.push(audioSeq);

    // Trim end of video sequence by +20 frames duration
    const trimCmd = new TrimSequenceCommand('v_seq_3', 0, 20);
    const trimmedDoc = trimCmd.execute(doc);

    const trimmedV = trimmedDoc.tracks[0].sequences.find((s) => s.id === 'v_seq_3')!;
    const trimmedA = trimmedDoc.tracks[1].sequences.find((s) => s.id === 'a_seq_3')!;

    expect(trimmedV.time.duration).toBe(120);
    expect(trimmedA.time.duration).toBe(120);

    // Trim head of audio sequence (deltaStartFrame = +10, deltaDurationFrames = -10)
    const trimHeadCmd = new TrimSequenceCommand('a_seq_3', 10, -10);
    const trimmedHeadDoc = trimHeadCmd.execute(trimmedDoc);

    const thV = trimmedHeadDoc.tracks[0].sequences.find((s) => s.id === 'v_seq_3')!;
    const thA = trimmedHeadDoc.tracks[1].sequences.find((s) => s.id === 'a_seq_3')!;

    expect(thA.time.start).toBe(60);
    expect(thA.time.duration).toBe(110);
    expect(thV.time.start).toBe(60);
    expect(thV.time.duration).toBe(110);
  });

  test('Unlinked A/V sequence (enabled: false) permits independent movement and trim', () => {
    const videoSeq: IRSequence = {
      id: 'v_seq_unlinked',
      type: 'video',
      time: { start: 10, duration: 100 },
      modifiers: [
        {
          id: 'mod_link_vu',
          type: 'editorial/av_link',
          params: {
            linkedSequenceId: 'a_seq_unlinked',
            linkedTrackId: 'track-a1',
            enabled: false, // LINK DISABLED
            syncTrim: true,
          },
        },
      ],
    };

    const audioSeq: IRSequence = {
      id: 'a_seq_unlinked',
      type: 'audio',
      time: { start: 10, duration: 100 },
      modifiers: [
        {
          id: 'mod_link_au',
          type: 'editorial/av_link',
          params: {
            linkedSequenceId: 'v_seq_unlinked',
            linkedTrackId: 'track-v1',
            enabled: false, // LINK DISABLED
            syncTrim: true,
          },
        },
      ],
    };

    doc.tracks[0].sequences.push(videoSeq);
    doc.tracks[1].sequences.push(audioSeq);

    // Move only video
    const moveCmd = new MoveSequenceCommand('v_seq_unlinked', 'track-v1', 50);
    const movedDoc = moveCmd.execute(doc);

    const movedV = movedDoc.tracks[0].sequences.find((s) => s.id === 'v_seq_unlinked')!;
    const unmovedA = movedDoc.tracks[1].sequences.find((s) => s.id === 'a_seq_unlinked')!;

    expect(movedV.time.start).toBe(50);
    // Audio sequence remains completely stationary at frame 10:
    expect(unmovedA.time.start).toBe(10);

    // Trim only audio
    const trimCmd = new TrimSequenceCommand('a_seq_unlinked', 0, -30);
    const trimmedDoc = trimCmd.execute(movedDoc);

    const trimmedA = trimmedDoc.tracks[1].sequences.find((s) => s.id === 'a_seq_unlinked')!;
    const vStill = trimmedDoc.tracks[0].sequences.find((s) => s.id === 'v_seq_unlinked')!;

    expect(trimmedA.time.duration).toBe(70);
    // Video sequence duration remains unchanged:
    expect(vStill.time.duration).toBe(100);
  });
});
