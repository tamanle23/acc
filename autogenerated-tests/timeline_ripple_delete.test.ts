import { describe, it, expect } from 'bun:test';
import type { VideoIRDocument, IRSequence } from '../packages/ir/src/types/VideoIR';
import { RippleDeleteSequenceCommand } from '../apps/studio/src/lib/commands/RippleDeleteSequenceCommand';
import { RippleDeleteCommand } from '../apps/studio/src/lib/timeline/commands/RippleDeleteCommand';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';

describe('Professional NLE Ripple Delete & Editorial Workflows Suite', () => {

  // Helper to create test document
  function createTestDoc(): VideoIRDocument {
    return {
      version: '1.0.0',
      meta: {
        title: 'Ripple Delete Test Project',
        fps: 30,
        nextSequenceIndex: 10,
      },
      tracks: [
        {
          id: 'track-v1',
          name: 'V1',
          type: 'video',
          sequences: [
            {
              id: 'seq-v1-1',
              name: 'Intro',
              type: 'video',
              time: { start: 0, duration: 90 },
            },
            {
              id: 'seq-v1-2',
              name: 'Middle',
              type: 'video',
              time: { start: 90, duration: 60 },
            },
            {
              id: 'seq-v1-3',
              name: 'Outro',
              type: 'video',
              time: { start: 150, duration: 90 },
            },
          ],
        },
      ],
    };
  }

  // =========================================================================
  // 1. Single-Track Ripple Delete & Gap Closure
  // =========================================================================
  describe('Single-Track Gap Closure', () => {
    it('deletes target clip and shifts downstream clips backward by deleted duration', () => {
      const doc = createTestDoc();
      const cmd = new RippleDeleteSequenceCommand('seq-v1-2', false);

      const modified = cmd.execute(doc);
      const v1 = modified.tracks.find((t) => t.id === 'track-v1')!;

      // Should have 2 sequences left: seq-v1-1 and seq-v1-3
      expect(v1.sequences.length).toBe(2);
      expect(v1.sequences.some((s) => s.id === 'seq-v1-2')).toBe(false);

      // seq-v1-1 untouched (start 0, duration 90)
      const s1 = v1.sequences.find((s) => s.id === 'seq-v1-1')!;
      expect(s1.time.start).toBe(0);

      // seq-v1-3 shifted from 150 -> 150 - 60 = 90
      const s3 = v1.sequences.find((s) => s.id === 'seq-v1-3')!;
      expect(s3.time.start).toBe(90);
    });
  });

  // =========================================================================
  // 2. Multi-Track Ripple Delete with Locked Track Immunity
  // =========================================================================
  describe('Multi-Track Ripple with Locked Track Immunity', () => {
    it('shifts all unlocked tracks while strictly maintaining locked track clip positions', () => {
      const doc: VideoIRDocument = {
        version: '1.0.0',
        meta: { title: 'Multi-Track Test', fps: 30 },
        tracks: [
          {
            id: 'track-v1',
            type: 'video',
            sequences: [
              { id: 'v1-clip1', type: 'video', time: { start: 0, duration: 100 } },
              { id: 'v1-target', type: 'video', time: { start: 100, duration: 50 } }, // Target to delete
              { id: 'v1-downstream', type: 'video', time: { start: 150, duration: 80 } },
            ],
          },
          {
            id: 'track-v2', // Unlocked background B-roll
            type: 'video',
            sequences: [
              { id: 'v2-clip1', type: 'video', time: { start: 0, duration: 80 } },
              { id: 'v2-downstream', type: 'video', time: { start: 120, duration: 90 } }, // start >= 100
            ],
          },
          {
            id: 'track-locked-audio', // Locked voiceover track
            type: 'audio',
            locked: true,
            sequences: [
              { id: 'vo-clip1', type: 'audio', time: { start: 0, duration: 60 } },
              { id: 'vo-downstream', type: 'audio', time: { start: 140, duration: 100 } }, // start >= 100
            ],
          },
        ],
      };

      const cmd = new RippleDeleteSequenceCommand('v1-target', true);
      const modified = cmd.execute(doc);

      // Track V1
      const v1 = modified.tracks.find((t) => t.id === 'track-v1')!;
      expect(v1.sequences.some((s) => s.id === 'v1-target')).toBe(false);
      const v1Down = v1.sequences.find((s) => s.id === 'v1-downstream')!;
      expect(v1Down.time.start).toBe(100); // 150 - 50 = 100

      // Track V2 (unlocked): v2-downstream shifted from 120 -> 120 - 50 = 70
      const v2 = modified.tracks.find((t) => t.id === 'track-v2')!;
      const v2Down = v2.sequences.find((s) => s.id === 'v2-downstream')!;
      expect(v2Down.time.start).toBe(70);

      // Track Locked Audio: strictly immune, vo-downstream must stay at 140
      const lockedTrack = modified.tracks.find((t) => t.id === 'track-locked-audio')!;
      const voDown = lockedTrack.sequences.find((s) => s.id === 'vo-downstream')!;
      expect(voDown.time.start).toBe(140);
    });
  });

  // =========================================================================
  // 3. Linked A/V Simultaneous Ripple Deletion
  // =========================================================================
  describe('Linked A/V Synchronous Ripple Deletion', () => {
    it('deletes reciprocal linked companion clip and ripples both companion tracks', () => {
      const doc: VideoIRDocument = {
        version: '1.0.0',
        meta: { title: 'Linked AV Test', fps: 30 },
        tracks: [
          {
            id: 'track-v1',
            type: 'video',
            sequences: [
              {
                id: 'video-target',
                type: 'video',
                time: { start: 50, duration: 40 },
                modifiers: [
                  {
                    type: 'editorial/av_link',
                    params: { linkedSequenceId: 'audio-linked', linkedTrackId: 'track-a1' },
                  },
                ],
              },
              {
                id: 'video-after',
                type: 'video',
                time: { start: 90, duration: 30 },
              },
            ],
          },
          {
            id: 'track-a1',
            type: 'audio',
            sequences: [
              {
                id: 'audio-linked',
                type: 'audio',
                time: { start: 50, duration: 40 },
                modifiers: [
                  {
                    type: 'editorial/av_link',
                    params: { linkedSequenceId: 'video-target', linkedTrackId: 'track-v1' },
                  },
                ],
              },
              {
                id: 'audio-after',
                type: 'audio',
                time: { start: 90, duration: 30 },
              },
            ],
          },
        ],
      };

      const cmd = new RippleDeleteSequenceCommand('video-target', false);
      const modified = cmd.execute(doc);

      const vTrack = modified.tracks.find((t) => t.id === 'track-v1')!;
      const aTrack = modified.tracks.find((t) => t.id === 'track-a1')!;

      // Both target video and companion linked audio are deleted
      expect(vTrack.sequences.some((s) => s.id === 'video-target')).toBe(false);
      expect(aTrack.sequences.some((s) => s.id === 'audio-linked')).toBe(false);

      // Both tracks' downstream sequences are shifted from 90 -> 90 - 40 = 50
      expect(vTrack.sequences.find((s) => s.id === 'video-after')!.time.start).toBe(50);
      expect(aTrack.sequences.find((s) => s.id === 'audio-after')!.time.start).toBe(50);
    });
  });

  // =========================================================================
  // 4. Bit-Identical Undo/Redo State Inversion
  // =========================================================================
  describe('Bit-Identical Undo/Redo Restoration', () => {
    it('restores all deleted and shifted clips to exact original state on undo()', () => {
      const doc = createTestDoc();
      const originalJSON = JSON.stringify(doc);

      const cmd = new RippleDeleteSequenceCommand('seq-v1-2', false);
      const modified = cmd.execute(doc);

      expect(JSON.stringify(modified)).not.toBe(originalJSON);

      const restored = cmd.undo(modified);
      expect(JSON.stringify(restored)).toBe(originalJSON);
    });
  });

  // =========================================================================
  // 5. TimelineCommand Dispatcher & Edge Cases
  // =========================================================================
  describe('TimelineCommand Dispatcher & Edge Case Resilience', () => {
    it('dispatches RippleDeleteCommand via TimelineCommand interface', () => {
      const stateManager = IRStateManager.getInstance();
      const currentDoc = stateManager.getState().doc;
      const targetSeq = currentDoc.tracks[0]?.sequences[0];
      if (!targetSeq) return;

      const rippleCmd = new RippleDeleteCommand(targetSeq.id, false);
      expect(rippleCmd.type).toBe('RIPPLE_DELETE');
      expect(rippleCmd.id).toBe('RIPPLE_DELETE_COMMAND');

      rippleCmd.execute(stateManager);
      const afterDelete = stateManager.getState().doc;
      expect(afterDelete.tracks[0]?.sequences.some((s) => s.id === targetSeq.id)).toBe(false);

      // Verify undo
      rippleCmd.undo(stateManager);
      const afterUndo = stateManager.getState().doc;
      expect(afterUndo.tracks[0]?.sequences.some((s) => s.id === targetSeq.id)).toBe(true);
    });

    it('gracefully handles non-existent clip ID without modifying document', () => {
      const doc = createTestDoc();
      const cmd = new RippleDeleteSequenceCommand('non-existent-seq-999', true);
      const modified = cmd.execute(doc);
      expect(JSON.stringify(modified)).toBe(JSON.stringify(doc));
    });
  });
});
