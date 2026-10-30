import { describe, it, expect } from 'bun:test';
import {
  VideoIRAuthoringEngine,
  VideoIRSchemaValidator,
  RelationalDAGCompiler,
  type VideoIRDocument,
  type IRTrack,
} from '../packages/ir/src';
import { drawCanvasCaptionsFromSnapshot } from '../packages/effect-engines/src';
import { ReorderTrackCommand } from '../apps/studio/src/lib/commands/ReorderTrackCommand';

function createMixedDoc(): VideoIRDocument {
  return {
    version: '1.0.0-stable',
    meta: {
      contentId: 'test_group_order_doc',
      globalFps: 30,
      canvasSize: { w: 1920, h: 1080 },
    },
    tracks: [
      { id: 'track_tt1', type: 'timed_text', name: 'Primary Subtitles', groupOrder: 0, sequences: [] },
      { id: 'track_tt2', type: 'timed_text', name: 'Secondary Subtitles', groupOrder: 1, sequences: [] },
      { id: 'track_v1', type: 'video', name: 'Main Video', groupOrder: 0, sequences: [] },
      { id: 'track_v2', type: 'video', name: 'B-Roll Overlay', groupOrder: 1, sequences: [] },
      { id: 'track_v3', type: 'video', name: 'Particles Overlay', groupOrder: 2, sequences: [] },
      { id: 'track_a1', type: 'audio', name: 'Dialogue', groupOrder: 0, sequences: [] },
      { id: 'track_a2', type: 'audio', name: 'BGM Music', groupOrder: 1, sequences: [] },
    ],
  };
}

describe('Track Grouping, groupOrder, and Supreme Timed-Text Flat Stack Suite', () => {
  describe('1. Modality Grouping and groupOrder Normalization', () => {
    it('resolves correct modality groups for standard track types', () => {
      expect(VideoIRAuthoringEngine.getTrackModalityGroup('timed_text')).toBe('timed_text');
      expect(VideoIRAuthoringEngine.getTrackModalityGroup('video')).toBe('video');
      expect(VideoIRAuthoringEngine.getTrackModalityGroup('audio')).toBe('audio');
      expect(VideoIRAuthoringEngine.getTrackModalityGroup('data')).toBe('data');
    });

    it('groups mixed tracks into modality partitions with sorted groupOrders', () => {
      const doc = createMixedDoc();
      const grouped = VideoIRAuthoringEngine.groupTracksByType(doc.tracks);

      expect(grouped.timed_text.length).toBe(2);
      expect(grouped.video.length).toBe(3);
      expect(grouped.audio.length).toBe(2);
      expect(grouped.data.length).toBe(0);

      expect(grouped.timed_text[0].id).toBe('track_tt1');
      expect(grouped.timed_text[0].groupOrder).toBe(0);
      expect(grouped.timed_text[1].id).toBe('track_tt2');
      expect(grouped.timed_text[1].groupOrder).toBe(1);

      expect(grouped.video[0].id).toBe('track_v1');
      expect(grouped.video[1].id).toBe('track_v2');
      expect(grouped.video[2].id).toBe('track_v3');
    });

    it('falls back to document index for legacy tracks missing groupOrder', () => {
      const legacyTracks: IRTrack[] = [
        { id: 'v_main', type: 'video', sequences: [] },
        { id: 'a_bgm', type: 'audio', sequences: [] },
        { id: 'v_overlay', type: 'video', sequences: [] },
        { id: 'tt_sub', type: 'timed_text', sequences: [] },
      ];

      const grouped = VideoIRAuthoringEngine.groupTracksByType(legacyTracks);

      expect(grouped.video.length).toBe(2);
      expect(grouped.video[0].id).toBe('v_main');
      expect(grouped.video[0].groupOrder).toBe(0);
      expect(grouped.video[1].id).toBe('v_overlay');
      expect(grouped.video[1].groupOrder).toBe(1);

      expect(grouped.audio.length).toBe(1);
      expect(grouped.audio[0].id).toBe('a_bgm');
      expect(grouped.audio[0].groupOrder).toBe(0);

      expect(grouped.timed_text.length).toBe(1);
      expect(grouped.timed_text[0].id).toBe('tt_sub');
      expect(grouped.timed_text[0].groupOrder).toBe(0);
    });
  });

  describe('2. Intra-Group Reordering Isolation', () => {
    it('reorders tracks strictly within their modality group without crossing boundaries', () => {
      const doc = createMixedDoc();

      // Move track_v2 up -> should swap with track_v1, never touching track_tt2 or track_a1
      const reordered = VideoIRAuthoringEngine.reorderTrackInGroup(doc, 'track_v2', 'up');
      const grouped = VideoIRAuthoringEngine.groupTracksByType(reordered.tracks);

      expect(grouped.video[0].id).toBe('track_v2');
      expect(grouped.video[0].groupOrder).toBe(0);
      expect(grouped.video[1].id).toBe('track_v1');
      expect(grouped.video[1].groupOrder).toBe(1);
      expect(grouped.video[2].id).toBe('track_v3');
      expect(grouped.video[2].groupOrder).toBe(2);

      // Verify timed_text and audio remain unchanged
      expect(grouped.timed_text[0].id).toBe('track_tt1');
      expect(grouped.timed_text[1].id).toBe('track_tt2');
      expect(grouped.audio[0].id).toBe('track_a1');
      expect(grouped.audio[1].id).toBe('track_a2');
    });

    it('safely bounds reorder operations when attempting to move past group edges', () => {
      const doc = createMixedDoc();

      // track_v1 is at group index 0; moving up must be a safe no-op
      const unchangedUp = VideoIRAuthoringEngine.reorderTrackInGroup(doc, 'track_v1', 'up');
      expect(unchangedUp.tracks.map((t) => t.id)).toEqual(doc.tracks.map((t) => t.id));

      // track_v3 is at group index 2 (last); moving down must be a safe no-op
      const unchangedDown = VideoIRAuthoringEngine.reorderTrackInGroup(doc, 'track_v3', 'down');
      expect(unchangedDown.tracks.map((t) => t.id)).toEqual(doc.tracks.map((t) => t.id));
    });

    it('reorders timed_text tracks strictly within the timed_text group', () => {
      const doc = createMixedDoc();
      const reordered = VideoIRAuthoringEngine.reorderTrackInGroup(doc, 'track_tt1', 'down');
      const grouped = VideoIRAuthoringEngine.groupTracksByType(reordered.tracks);

      expect(grouped.timed_text[0].id).toBe('track_tt2');
      expect(grouped.timed_text[0].groupOrder).toBe(0);
      expect(grouped.timed_text[1].id).toBe('track_tt1');
      expect(grouped.timed_text[1].groupOrder).toBe(1);
    });
  });

  describe('3. ReorderTrackCommand Undo / Redo Lifecycle', () => {
    it('executes reordering and restores exact previous snapshot on undo', () => {
      const doc = createMixedDoc();
      const cmd = new ReorderTrackCommand('track_v2', 'up');

      const executedDoc = cmd.execute(doc);
      const executedGroup = VideoIRAuthoringEngine.groupTracksByType(executedDoc.tracks);
      expect(executedGroup.video[0].id).toBe('track_v2');

      const undoneDoc = cmd.undo(executedDoc);
      const undoneGroup = VideoIRAuthoringEngine.groupTracksByType(undoneDoc.tracks);
      expect(undoneGroup.video[0].id).toBe('track_v1');
      expect(undoneGroup.video[1].id).toBe('track_v2');
    });
  });

  describe('4. Schema Validation & Compiler Integration', () => {
    it('validates non-negative integer groupOrder successfully', () => {
      const doc = createMixedDoc();
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    it('rejects negative or fractional groupOrder', () => {
      const doc = createMixedDoc();
      (doc.tracks[0] as any).groupOrder = -1;

      const resNegative = VideoIRSchemaValidator.validate(doc);
      expect(resNegative.valid).toBe(false);
      expect(resNegative.errors.some((e) => e.includes('"groupOrder" must be a non-negative integer'))).toBe(true);

      (doc.tracks[0] as any).groupOrder = 2.5;
      const resFractional = VideoIRSchemaValidator.validate(doc);
      expect(resFractional.valid).toBe(false);
      expect(resFractional.errors.some((e) => e.includes('"groupOrder" must be a non-negative integer'))).toBe(true);
    });

    it('passes groupOrder through DAG compilation to ResolvedTrack', async () => {
      const doc = createMixedDoc();
      const compiler = new RelationalDAGCompiler();
      const timeline = await compiler.compile(doc);

      const resolvedV1 = timeline.tracks.get('track_v1');
      expect(resolvedV1).toBeDefined();
      expect(resolvedV1?.groupOrder).toBe(0);

      const resolvedV2 = timeline.tracks.get('track_v2');
      expect(resolvedV2?.groupOrder).toBe(1);
    });
  });

  describe('5. Subtitle Anti-Collision Slot Stacking', () => {
    it('computes distinct vertical slot offsets for concurrent subtitle tracks', () => {
      const mockCtx = {
        save: () => {},
        restore: () => {},
        measureText: () => ({ width: 100 }),
        fillText: () => {},
        strokeText: () => {},
        beginPath: () => {},
        fill: () => {},
        fillRect: () => {},
      };

      const snapshot = {
        shouldRender: true,
        phrase: [{ text: 'Hello World', start: 0, end: 3 }],
        activeWord: null,
      };

      let capturedY0 = 0;
      let capturedY1 = 0;

      // Mock fillText to spy on Y coordinate
      (mockCtx as any).fillText = (_text: string, _x: number, y: number) => {
        capturedY0 = y;
      };

      drawCanvasCaptionsFromSnapshot(
        mockCtx as any,
        snapshot as any,
        { slotIndex: 0, position: 'bottom', fontSize: 40, marginV: 60 } as any,
        1920,
        1080
      );

      (mockCtx as any).fillText = (_text: string, _x: number, y: number) => {
        capturedY1 = y;
      };

      drawCanvasCaptionsFromSnapshot(
        mockCtx as any,
        snapshot as any,
        { slotIndex: 1, position: 'bottom', fontSize: 40, marginV: 60 } as any,
        1920,
        1080
      );

      // Slot 1 must be stacked above Slot 0 for bottom position: capturedY1 < capturedY0
      expect(capturedY0).toBeGreaterThan(0);
      expect(capturedY1).toBeGreaterThan(0);
      expect(capturedY0 - capturedY1).toBeGreaterThanOrEqual(40);
    });
  });
});
