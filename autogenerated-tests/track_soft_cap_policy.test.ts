import { describe, it, expect } from 'bun:test';
import {
  VideoIRAuthoringEngine,
  DEFAULT_TRACK_AUTHORING_POLICY,
  type TrackAuthoringPolicy,
} from '../packages/ir/src/authoring/VideoIRAuthoringEngine';
import type { VideoIRDocument, IRTrack } from '../packages/ir/src/types/VideoIR';

function createBaseDoc(tracks: IRTrack[] = []): VideoIRDocument {
  return {
    version: '1.0.0-stable',
    meta: {
      contentId: 'test_track_policy_doc',
      globalFps: 30,
      canvasSize: { w: 1920, h: 1080 },
    },
    tracks,
  };
}

describe('Track Soft-Cap Constraints & Semantic Track Quotas Suite', () => {
  describe('1. Semantic Track Role Classification', () => {
    it('correctly classifies audio and timed_text tracks', () => {
      const audioTrack: IRTrack = { id: 'track_a1', type: 'audio', sequences: [] };
      const textTrack: IRTrack = { id: 'track_tt1', type: 'timed_text', sequences: [] };

      expect(VideoIRAuthoringEngine.classifyTrackRole(audioTrack)).toBe('audio');
      expect(VideoIRAuthoringEngine.classifyTrackRole(textTrack)).toBe('text');
    });

    it('identifies main track via index 0 or explicit naming/ID', () => {
      const track0: IRTrack = { id: 'track_v1', type: 'video', sequences: [] };
      const explicitMainTrack: IRTrack = {
        id: 'track_v_main',
        type: 'video',
        name: 'Main Story Spine',
        sequences: [],
      };

      expect(VideoIRAuthoringEngine.classifyTrackRole(track0, 0)).toBe('main');
      expect(VideoIRAuthoringEngine.classifyTrackRole(explicitMainTrack, 1)).toBe('main');
    });

    it('identifies sticker and emoji tracks', () => {
      const stickerTrack1: IRTrack = {
        id: 'track_v_sticker_1',
        type: 'video',
        name: 'Animated Stickers',
        sequences: [],
      };
      const emojiTrack: IRTrack = {
        id: 'track_v_overlay_2',
        type: 'video',
        name: 'Reaction Emoji Layer',
        sequences: [],
      };

      expect(VideoIRAuthoringEngine.classifyTrackRole(stickerTrack1, 1)).toBe('stickers');
      expect(VideoIRAuthoringEngine.classifyTrackRole(emojiTrack, 2)).toBe('stickers');
    });

    it('identifies effects and adjustment tracks', () => {
      const fxTrack: IRTrack = {
        id: 'track_v_fx_1',
        type: 'video',
        name: 'Color Grade & Bloom Filter',
        sequences: [],
      };
      const modifierTrack: IRTrack = {
        id: 'track_v2',
        type: 'video',
        modifiers: [
          {
            id: 'mod_lut_1',
            type: 'color/lut',
            target: 'track',
            params: { preset: 'cyberpunk' },
          },
        ],
        sequences: [],
      };

      expect(VideoIRAuthoringEngine.classifyTrackRole(fxTrack, 1)).toBe('effects');
      expect(VideoIRAuthoringEngine.classifyTrackRole(modifierTrack, 2)).toBe('effects');
    });

    it('classifies subsequent standard video tracks as overlays', () => {
      const overlayTrack1: IRTrack = {
        id: 'track_v2',
        type: 'video',
        name: 'B-Roll PIP Cut',
        sequences: [],
      };
      const overlayTrack2: IRTrack = {
        id: 'track_v_overlay_1',
        type: 'video',
        sequences: [],
      };

      expect(VideoIRAuthoringEngine.classifyTrackRole(overlayTrack1, 1)).toBe('overlay');
      expect(VideoIRAuthoringEngine.classifyTrackRole(overlayTrack2, 2)).toBe('overlay');
    });
  });

  describe('2. Quota Evaluation & Threshold Status', () => {
    it('evaluates current counts across all semantic roles', () => {
      const doc = createBaseDoc([
        { id: 'track_v1', type: 'video', name: 'Main', sequences: [] },
        { id: 'track_v2', type: 'video', name: 'PIP 1', sequences: [] },
        { id: 'track_v3', type: 'video', name: 'PIP 2', sequences: [] },
        { id: 'track_a1', type: 'audio', name: 'Dialogue', sequences: [] },
        { id: 'track_tt1', type: 'timed_text', name: 'Captions', sequences: [] },
      ]);

      const quotas = VideoIRAuthoringEngine.evaluateTrackQuotas(doc);
      expect(quotas.main.currentCount).toBe(1);
      expect(quotas.overlay.currentCount).toBe(2);
      expect(quotas.audio.currentCount).toBe(1);
      expect(quotas.text.currentCount).toBe(1);
      expect(quotas.effects.currentCount).toBe(0);
      expect(quotas.stickers.currentCount).toBe(0);

      expect(quotas.overlay.isSoftCapExceeded).toBe(false);
      expect(quotas.overlay.isHardCapReached).toBe(false);
    });

    it('flags soft-cap threshold warning when overlay count reaches 6', () => {
      const overlayTracks: IRTrack[] = Array.from({ length: 6 }, (_, i) => ({
        id: `track_v_overlay_${i + 1}`,
        type: 'video',
        name: `Overlay ${i + 1}`,
        sequences: [],
      }));

      const doc = createBaseDoc([
        { id: 'track_v_main', type: 'video', name: 'Main', sequences: [] },
        ...overlayTracks,
      ]);

      const quotas = VideoIRAuthoringEngine.evaluateTrackQuotas(doc);
      expect(quotas.overlay.currentCount).toBe(6);
      expect(quotas.overlay.isSoftCapExceeded).toBe(true);
      expect(quotas.overlay.isHardCapReached).toBe(false);
      expect(quotas.overlay.message).toContain('Soft cap reached');
    });
  });

  describe('3. Gatekeeping & Hard-Cap Enforcement via canAddTrack', () => {
    it('returns isWarning: true when adding a track reaches the soft cap', () => {
      // 5 existing overlay tracks; adding 6th reaches softCap of 6
      const existingOverlays: IRTrack[] = Array.from({ length: 5 }, (_, i) => ({
        id: `track_v_overlay_${i + 1}`,
        type: 'video',
        name: `Overlay ${i + 1}`,
        sequences: [],
      }));

      const doc = createBaseDoc([
        { id: 'track_v_main', type: 'video', name: 'Main', sequences: [] },
        ...existingOverlays,
      ]);

      const check = VideoIRAuthoringEngine.canAddTrack(doc, 'overlay');
      expect(check.allowed).toBe(true);
      expect(check.isWarning).toBe(true);
      expect(check.role).toBe('overlay');
      expect(check.reason).toContain('Soft cap reached');
    });

    it('rejects 11th overlay track when isManualUserOverride is false (hard cap = 10)', () => {
      const tenOverlays: IRTrack[] = Array.from({ length: 10 }, (_, i) => ({
        id: `track_v_overlay_${i + 1}`,
        type: 'video',
        name: `Overlay ${i + 1}`,
        sequences: [],
      }));

      const doc = createBaseDoc([
        { id: 'track_v_main', type: 'video', name: 'Main', sequences: [] },
        ...tenOverlays,
      ]);

      const check = VideoIRAuthoringEngine.canAddTrack(doc, 'overlay', DEFAULT_TRACK_AUTHORING_POLICY, false);
      expect(check.allowed).toBe(false);
      expect(check.isWarning).toBe(true);
      expect(check.reason).toContain('Hard cap of 10 reached');
    });

    it('allows 11th overlay track when isManualUserOverride is true with warning reason', () => {
      const tenOverlays: IRTrack[] = Array.from({ length: 10 }, (_, i) => ({
        id: `track_v_overlay_${i + 1}`,
        type: 'video',
        name: `Overlay ${i + 1}`,
        sequences: [],
      }));

      const doc = createBaseDoc([
        { id: 'track_v_main', type: 'video', name: 'Main', sequences: [] },
        ...tenOverlays,
      ]);

      const check = VideoIRAuthoringEngine.canAddTrack(doc, 'overlay', DEFAULT_TRACK_AUTHORING_POLICY, true);
      expect(check.allowed).toBe(true);
      expect(check.isWarning).toBe(true);
      expect(check.reason).toContain('manual user override');
    });

    it('supports custom policy ingestion with arbitrary caps', () => {
      const customPolicy: TrackAuthoringPolicy = {
        limits: {
          main: { softCap: 1, hardCap: 1 },
          overlay: { softCap: 2, hardCap: 3 },
          text: { softCap: 1, hardCap: 2 },
          effects: { softCap: 1, hardCap: 2 },
          stickers: { softCap: 1, hardCap: 2 },
          audio: { softCap: 1, hardCap: 2 },
        },
        allowHardCapOverride: false,
      };

      // 1 existing overlay track
      const doc = createBaseDoc([
        { id: 'track_v_main', type: 'video', sequences: [] },
        { id: 'track_v_overlay_1', type: 'video', sequences: [] },
      ]);

      // Adding 2nd overlay triggers warning because softCap is 2
      const check2nd = VideoIRAuthoringEngine.canAddTrack(doc, 'overlay', customPolicy);
      expect(check2nd.allowed).toBe(true);
      expect(check2nd.isWarning).toBe(true);

      // Now add 2 more so count is 3 (at hard cap)
      doc.tracks.push(
        { id: 'track_v_overlay_2', type: 'video', sequences: [] },
        { id: 'track_v_overlay_3', type: 'video', sequences: [] }
      );

      // Adding 4th overlay must be rejected and override is disallowed by customPolicy
      const check4th = VideoIRAuthoringEngine.canAddTrack(doc, 'overlay', customPolicy, true);
      expect(check4th.allowed).toBe(false);
      expect(check4th.reason).toContain('Hard cap of 3 reached');
    });
  });

  describe('4. Semantic Track ID Generation', () => {
    it('generates role-specific prefixes when role is provided', () => {
      const doc = createBaseDoc([
        { id: 'track_v_main_1', type: 'video', sequences: [] },
        { id: 'track_v_overlay_1', type: 'video', sequences: [] },
      ]);

      expect(VideoIRAuthoringEngine.generateNextTrackId(doc, 'video', 'overlay')).toBe('track_v_overlay_2');
      expect(VideoIRAuthoringEngine.generateNextTrackId(doc, 'video', 'effects')).toBe('track_v_fx_1');
      expect(VideoIRAuthoringEngine.generateNextTrackId(doc, 'video', 'stickers')).toBe('track_v_sticker_1');
      expect(VideoIRAuthoringEngine.generateNextTrackId(doc, 'audio', 'audio')).toBe('track_a_1');
      expect(VideoIRAuthoringEngine.generateNextTrackId(doc, 'timed_text', 'text')).toBe('track_tt_1');
    });

    it('preserves legacy prefix when role is omitted', () => {
      const doc = createBaseDoc([
        { id: 'track_v1', type: 'video', sequences: [] },
        { id: 'track_a1', type: 'audio', sequences: [] },
      ]);

      expect(VideoIRAuthoringEngine.generateNextTrackId(doc, 'video')).toBe('track_v2');
      expect(VideoIRAuthoringEngine.generateNextTrackId(doc, 'audio')).toBe('track_a2');
      expect(VideoIRAuthoringEngine.generateNextTrackId(doc, 'timed_text')).toBe('track_tt1');
    });
  });

  describe('5. Temporal Whitespace Reuse Fallback', () => {
    it('detects non-overlapping temporal whitespace on existing track', () => {
      const track: IRTrack = {
        id: 'track_v_overlay_1',
        type: 'video',
        sequences: [
          { id: 'seq_1', type: 'video', time: { start: 0, duration: 60 } },
          { id: 'seq_2', type: 'video', time: { start: 120, duration: 60 } },
        ],
      };

      // Candidate clip at [60, 120) fits exactly in the gap between seq_1 and seq_2
      expect(VideoIRAuthoringEngine.canPlaceSequenceOnTrack(track, 60, 60)).toBe(true);
      // Candidate clip at [50, 80) overlaps seq_1 ([0, 60))
      expect(VideoIRAuthoringEngine.canPlaceSequenceOnTrack(track, 50, 30)).toBe(false);
      // Candidate clip at [100, 150) overlaps seq_2 ([120, 180))
      expect(VideoIRAuthoringEngine.canPlaceSequenceOnTrack(track, 100, 50)).toBe(false);
      // Candidate clip at [180, 240) fits after seq_2
      expect(VideoIRAuthoringEngine.canPlaceSequenceOnTrack(track, 180, 60)).toBe(true);
    });

    it('finds existing track with whitespace matching the role instead of spawning new track', () => {
      const doc = createBaseDoc([
        { id: 'track_v_main', type: 'video', sequences: [{ id: 'seq_main', type: 'video', time: { start: 0, duration: 300 } }] },
        {
          id: 'track_v_overlay_1',
          type: 'video',
          name: 'Overlay 1',
          sequences: [{ id: 'seq_ov_1', type: 'video', time: { start: 0, duration: 90 } }],
        },
        {
          id: 'track_v_overlay_2',
          type: 'video',
          name: 'Overlay 2',
          sequences: [{ id: 'seq_ov_2', type: 'video', time: { start: 90, duration: 90 } }],
        },
      ]);

      // A candidate overlay at [100, 150) cannot go on track_v_overlay_2 (occupied [90, 180)),
      // but track_v_overlay_1 is free after frame 90!
      const whitespaceTrack = VideoIRAuthoringEngine.findWhitespaceTrack(doc, 'overlay', 100, 50);
      expect(whitespaceTrack).not.toBeNull();
      expect(whitespaceTrack?.id).toBe('track_v_overlay_1');
    });
  });
});
