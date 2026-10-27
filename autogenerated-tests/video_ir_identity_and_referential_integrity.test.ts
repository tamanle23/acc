import { describe, it, expect } from 'bun:test';
import { VideoIRSchemaValidator } from '../packages/ir/src/schema/VideoIRSchemaValidator';
import { VideoIRAuthoringEngine } from '../packages/ir/src/authoring/VideoIRAuthoringEngine';
import type { VideoIRDocument } from '../packages/ir/src/types/VideoIR';
import { SplitSequenceCommand } from '../apps/studio/src/lib/commands/SplitSequenceCommand';
import { DuplicateSequenceCommand } from '../apps/studio/src/lib/commands/DuplicateSequenceCommand';

function createValidDoc(): VideoIRDocument {
  return {
    version: '1.0.0-stable',
    meta: {
      contentId: 'test_integrity_doc',
      globalFps: 30,
      canvasSize: { w: 1920, h: 1080 },
      nextSequenceIndex: 3,
    },
    tracks: [
      {
        id: 'track_v1',
        type: 'video',
        name: 'Primary Video Plate',
        sequences: [
          {
            id: 'seq_video_hero_shot_1',
            name: 'Hero Shot',
            type: 'video',
            time: { start: 0, duration: 90 },
          },
          {
            id: 'seq_video_broll_2',
            name: 'B-Roll Cut',
            type: 'video',
            time: { start: { after: 'seq_video_hero_shot_1' }, duration: 60 },
          },
        ],
      },
    ],
  };
}

describe('VideoIR Identity & Referential Integrity Suite', () => {
  describe('1. Global Sequence ID Uniqueness', () => {
    it('accepts document with unique sequence IDs across tracks', () => {
      const doc = createValidDoc();
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    it('rejects duplicate sequence ID on the same track', () => {
      const doc = createValidDoc();
      doc.tracks[0].sequences[1].id = 'seq_video_hero_shot_1';

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Duplicate sequence id "seq_video_hero_shot_1"'))).toBe(true);
    });

    it('rejects duplicate sequence ID across different tracks', () => {
      const doc = createValidDoc();
      doc.tracks.push({
        id: 'track_a1',
        type: 'audio',
        sequences: [
          {
            id: 'seq_video_hero_shot_1', // Duplicate from video track
            type: 'audio',
            time: { start: 0, duration: 90 },
          },
        ],
      });

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Duplicate sequence id "seq_video_hero_shot_1"'))).toBe(true);
    });

    it('permits duplicate sequence names and duplicate track names without error', () => {
      const doc = createValidDoc();
      // Both sequences have the exact same human-readable display name
      doc.tracks[0].sequences[0].name = 'Shared Label';
      doc.tracks[0].sequences[1].name = 'Shared Label';

      // Another track with identical track display name
      doc.tracks.push({
        id: 'track_v2',
        type: 'video',
        name: 'Primary Video Plate',
        sequences: [],
      });

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });
  });

  describe('2. Referential Integrity: Dangling & Self-Referencing Targets', () => {
    it('rejects dangling relational start "after"', () => {
      const doc = createValidDoc();
      (doc.tracks[0].sequences[1].time.start as any).after = 'non_existent_seq';

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Dangling relational reference') && e.includes('non_existent_seq'))).toBe(true);
    });

    it('rejects self-referencing start "after"', () => {
      const doc = createValidDoc();
      (doc.tracks[0].sequences[0].time.start as any) = { after: 'seq_video_hero_shot_1' };

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Self-referential relation rejected'))).toBe(true);
    });

    it('rejects dangling relational start "syncWith"', () => {
      const doc = createValidDoc();
      doc.tracks[0].sequences[0].time.start = { syncWith: 'missing_target_seq' };

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('missing_target_seq'))).toBe(true);
    });

    it('rejects dangling relational duration "matchLengthOf"', () => {
      const doc = createValidDoc();
      doc.tracks[0].sequences[0].time.duration = { matchLengthOf: 'ghost_seq' };

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('ghost_seq'))).toBe(true);
    });

    it('allows "matchLengthOf": "timeline" without requiring a sequence named timeline', () => {
      const doc = createValidDoc();
      doc.tracks[0].sequences[0].time.duration = { matchLengthOf: 'timeline' };

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
    });

    it('rejects dangling editorial/av_link modifier target', () => {
      const doc = createValidDoc();
      doc.tracks[0].sequences[0].modifiers = [
        {
          type: 'editorial/av_link',
          target: 'video',
          params: {
            linkedSequenceId: 'missing_audio_seq',
            linkedTrackId: 'track_a1',
          },
        },
      ];

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('missing_audio_seq'))).toBe(true);
    });

    it('rejects dangling transition overlapTarget', () => {
      const doc = createValidDoc();
      doc.tracks[0].sequences[1].modifiers = [
        {
          type: 'transition/crossfade',
          target: 'video',
          params: {
            durationFrames: 15,
            overlapTarget: 'unlinked_preceding_seq',
          },
        },
      ];

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('unlinked_preceding_seq'))).toBe(true);
    });
  });

  describe('3. VideoIRAuthoringEngine Monotonic Allocation & Track-Move Invariance', () => {
    it('generates clean slug-based sequence IDs with global counter', () => {
      const doc = createValidDoc();
      doc.meta.nextSequenceIndex = 10;

      const alloc = VideoIRAuthoringEngine.allocateNextSequenceId(doc, {
        type: 'video',
        nameOrSlug: 'Cyberpunk Metropolis Night Scene.mp4',
      });

      expect(alloc.id).toBe('seq_video_cyberpunk_metropolis_night_scene_10');
      expect(alloc.nextIndex).toBe(11);
      expect(doc.meta.nextSequenceIndex).toBe(11);
    });

    it('counter strictly advances forward even if earlier sequences are dropped', () => {
      const doc = createValidDoc();
      doc.meta.nextSequenceIndex = 5;

      const alloc1 = VideoIRAuthoringEngine.allocateNextSequenceId(doc, { type: 'audio', nameOrSlug: 'Voice 1' });
      expect(alloc1.id).toBe('seq_audio_voice_1_5');

      // Drop all existing sequences from document
      doc.tracks[0].sequences = [];

      // Next allocation continues forward using monotonic high-water mark
      const alloc2 = VideoIRAuthoringEngine.allocateNextSequenceId(doc, { type: 'text', nameOrSlug: 'Title' });
      expect(alloc2.id).toBe('seq_text_title_6');
      expect(doc.meta.nextSequenceIndex).toBe(7);
    });

    it('falls back to scanning max index if nextSequenceIndex is absent from legacy document', () => {
      const legacyDoc: VideoIRDocument = {
        version: '1.0.0-stable',
        meta: {
          contentId: 'legacy',
          globalFps: 30,
          canvasSize: { w: 1920, h: 1080 },
        },
        tracks: [
          {
            id: 'track_v1',
            type: 'video',
            sequences: [
              { id: 'seq_video_clip_3', type: 'video', time: { start: 0, duration: 30 } },
              { id: 'seq_video_clip_14', type: 'video', time: { start: 30, duration: 30 } },
            ],
          },
        ],
      };

      const resolved = VideoIRAuthoringEngine.resolveNextSequenceIndex(legacyDoc);
      expect(resolved).toBe(15);

      const alloc = VideoIRAuthoringEngine.allocateNextSequenceId(legacyDoc, { type: 'video' });
      expect(alloc.id).toBe('seq_video_15');
      expect(legacyDoc.meta.nextSequenceIndex).toBe(16);
    });

    it('generates deterministic track IDs', () => {
      const doc = createValidDoc();
      const vTrackId = VideoIRAuthoringEngine.generateNextTrackId(doc, 'video');
      expect(vTrackId).toBe('track_v2');

      const aTrackId = VideoIRAuthoringEngine.generateNextTrackId(doc, 'audio');
      expect(aTrackId).toBe('track_a1');

      const ttTrackId = VideoIRAuthoringEngine.generateNextTrackId(doc, 'timed_text');
      expect(ttTrackId).toBe('track_tt1');
    });
  });

  describe('4. Studio Commands Lifecycle & Schema Compliance', () => {
    it('SplitSequenceCommand: part 1 keeps original ID, part 2 gets next monotonic index and valid schema', () => {
      const doc = createValidDoc();
      const splitCmd = new SplitSequenceCommand('seq_video_hero_shot_1', 45, 0, 90);

      const executedDoc = splitCmd.execute(doc);
      expect(executedDoc.tracks[0].sequences.length).toBe(3);

      const part1 = executedDoc.tracks[0].sequences[0];
      const part2 = executedDoc.tracks[0].sequences[1];

      // Part 1 retains original ID
      expect(part1.id).toBe('seq_video_hero_shot_1');
      expect(part1.time.duration).toBe(45);

      // Part 2 gets next global index
      expect(part2.id).toBe('seq_video_hero_shot_3');
      expect(part2.name).toBe('Hero Shot (Part 2)');
      expect(part2.time.start).toEqual({ after: 'seq_video_hero_shot_1', offsetFrames: 0 });
      expect(part2.time.duration).toBe(45);

      // Entire document passes strict referential validation
      const validation = VideoIRSchemaValidator.validate(executedDoc);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);

      // Undo cleanly restores original state and sequence count
      const undoneDoc = splitCmd.undo(executedDoc);
      expect(undoneDoc.tracks[0].sequences.length).toBe(2);
      expect(undoneDoc.tracks[0].sequences[0].time.duration).toBe(90);
    });

    it('DuplicateSequenceCommand: cloned sequence gets monotonic index and valid schema', () => {
      const doc = createValidDoc();
      const dupCmd = new DuplicateSequenceCommand('seq_video_hero_shot_1');

      const executedDoc = dupCmd.execute(doc);
      expect(executedDoc.tracks[0].sequences.length).toBe(3);

      const duplicated = executedDoc.tracks[0].sequences[1];
      expect(duplicated.id).toBe('seq_video_hero_shot_3');
      expect(duplicated.name).toBe('Hero Shot (Copy)');

      const validation = VideoIRSchemaValidator.validate(executedDoc);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);

      const undoneDoc = dupCmd.undo(executedDoc);
      expect(undoneDoc.tracks[0].sequences.length).toBe(2);
    });
  });
});
