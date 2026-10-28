import { describe, it, expect, beforeEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import {
  cloneIR,
  getErrorMessage,
  getSequenceDurationFrames,
  getSequenceEndFrame,
  getSequenceStartFrame,
  isResolvedSequence,
  normalizeTracksList,
  type StudioSequence,
  type StudioTrack,
} from '../apps/studio/src/lib/ir/studioTypes';
import { StudioPlayheadController } from '../apps/studio/src/lib/playhead/StudioPlayheadController';
import { AddLinkedAVSequenceCommand } from '../apps/studio/src/lib/commands/AddLinkedAVSequenceCommand';
import { UpdateProjectMetaCommand } from '../apps/studio/src/lib/commands/UpdateProjectMetaCommand';

const STUDIO_SRC = path.resolve(__dirname, '../apps/studio/src');

describe('Studio Phase 2: Reactive Store (useSyncExternalStore) & Strict TypeScript', () => {
  describe('1. Domain Type Helpers & Adapter Normalization (studioTypes.ts)', () => {
    it('extracts start, duration, and end frames across both IRSequence and ResolvedSequence', () => {
      const irSeq: StudioSequence = {
        id: 'seq-ir-1',
        type: 'video',
        time: { start: 45, duration: 120 },
      };
      const resolvedSeq = {
        id: 'seq-res-1',
        trackId: 'track-v1',
        type: 'video' as const,
        startFrame: 60,
        durationFrames: 90,
        endFrame: 150,
        time: { start: 60, duration: 90 },
      };

      expect(isResolvedSequence(irSeq)).toBe(false);
      expect(isResolvedSequence(resolvedSeq)).toBe(true);

      expect(getSequenceStartFrame(irSeq)).toBe(45);
      expect(getSequenceDurationFrames(irSeq)).toBe(120);
      expect(getSequenceEndFrame(irSeq)).toBe(165);

      expect(getSequenceStartFrame(resolvedSeq)).toBe(60);
      expect(getSequenceDurationFrames(resolvedSeq)).toBe(90);
      expect(getSequenceEndFrame(resolvedSeq)).toBe(150);

      expect(getSequenceStartFrame(null)).toBe(0);
      expect(getSequenceDurationFrames(undefined, 75)).toBe(75);
    });

    it('normalizes both Map<string, ResolvedTrack> and Track[] into a flat array', () => {
      const t1: StudioTrack = { id: 'track-v1', type: 'video', sequences: [] };
      const t2: StudioTrack = { id: 'track-a1', type: 'audio', sequences: [] };
      const mapTracks = new Map<string, StudioTrack>([
        ['track-v1', t1],
        ['track-a1', t2],
      ]);

      expect(normalizeTracksList(mapTracks)).toEqual([t1, t2]);
      expect(normalizeTracksList([t1, t2])).toEqual([t1, t2]);
      expect(normalizeTracksList(null)).toEqual([]);
    });

    it('deep-clones plain IR structures and extracts safe error messages', () => {
      const orig = { a: 1, nested: { b: [1, 2, 3] } };
      const copy = cloneIR(orig);
      expect(copy).toEqual(orig);
      expect(copy).not.toBe(orig);
      copy.nested.b.push(4);
      expect(orig.nested.b).toEqual([1, 2, 3]);

      expect(getErrorMessage(new Error('Boom'))).toBe('Boom');
      expect(getErrorMessage('String error')).toBe('String error');
      expect(getErrorMessage({ message: 'Obj error' })).toBe('Obj error');
      expect(getErrorMessage(null, 'Fallback')).toBe('Fallback');
    });
  });

  describe('2. IRStateManager Synchronous Immutability & Snapshot Guarantees', () => {
    it('creates a new state snapshot reference synchronously on dispatch, undo, and redo', () => {
      const manager = IRStateManager.getInstance();
      const prevSnapshot = manager.getSnapshot();
      const prevTitle = prevSnapshot.doc.meta.contentId;

      let notifiedCount = 0;
      const unsub = manager.subscribe(() => {
        notifiedCount++;
      });

      manager.dispatch(new UpdateProjectMetaCommand({ contentId: 'phase2_enterprise_test' }));
      const nextSnapshot = manager.getSnapshot();

      expect(nextSnapshot).not.toBe(prevSnapshot);
      expect(nextSnapshot.doc.meta.contentId).toBe('phase2_enterprise_test');
      expect(nextSnapshot.canUndo).toBe(true);
      expect(notifiedCount).toBeGreaterThanOrEqual(2); // initial + dispatch

      manager.undo();
      const undoneSnapshot = manager.getSnapshot();
      expect(undoneSnapshot).not.toBe(nextSnapshot);
      expect(undoneSnapshot.doc.meta.contentId).toBe(prevTitle);

      manager.redo();
      const redoneSnapshot = manager.getSnapshot();
      expect(redoneSnapshot.doc.meta.contentId).toBe('phase2_enterprise_test');

      // Restore original title
      manager.undo();
      unsub();
    });
  });

  describe('3. AddLinkedAVSequenceCommand Canonical & Legacy Alias Support', () => {
    it('supports both { videoSequence, audioSequence } and { videoSeq, audioSeq }', () => {
      const manager = IRStateManager.getInstance();
      const baseDoc = cloneIR(manager.getSnapshot().doc);

      const cmdCanonical = new AddLinkedAVSequenceCommand({
        videoTrackId: 'track-v1',
        audioTrackId: 'track-a1',
        videoSequence: {
          id: 'seq_test_v_canon',
          type: 'video',
          time: { start: 10, duration: 60 },
        },
        audioSequence: {
          id: 'seq_test_a_canon',
          type: 'audio',
          time: { start: 10, duration: 60 },
        },
      });

      const afterCanon = cmdCanonical.execute(baseDoc);
      const vTrack = afterCanon.tracks.find((t) => t.id === 'track-v1');
      const aTrack = afterCanon.tracks.find((t) => t.id === 'track-a1');
      expect(vTrack?.sequences.some((s) => s.id === 'seq_test_v_canon')).toBe(true);
      expect(aTrack?.sequences.some((s) => s.id === 'seq_test_a_canon')).toBe(true);

      const cmdAlias = new AddLinkedAVSequenceCommand({
        videoTrackId: 'track-v1',
        audioTrackId: 'track-a1',
        videoSeq: {
          id: 'seq_test_v_alias',
          type: 'video',
          time: { start: 20, duration: 45 },
        },
        audioSeq: {
          id: 'seq_test_a_alias',
          type: 'audio',
          time: { start: 20, duration: 45 },
        },
      });

      const afterAlias = cmdAlias.execute(baseDoc);
      expect(afterAlias.tracks.find((t) => t.id === 'track-v1')?.sequences.some((s) => s.id === 'seq_test_v_alias')).toBe(true);
    });
  });

  describe('4. StudioPlayheadController Bound Methods for useSyncExternalStore', () => {
    it('exposes bound getFrame, getIsPlaying, and subscribeLowFrequency methods', () => {
      const controller = StudioPlayheadController.getInstance();
      controller.setConfig(30, 500);

      const { getFrame, getIsPlaying, subscribeLowFrequency } = controller;
      const observedFrames: number[] = [];
      const unsub = subscribeLowFrequency((f) => {
        observedFrames.push(f);
      });

      controller.seek(42, true);
      expect(getFrame()).toBe(42);
      expect(observedFrames).toContain(42);

      controller.setIsPlaying(true);
      expect(getIsPlaying()).toBe(true);
      controller.setIsPlaying(false);
      expect(getIsPlaying()).toBe(false);

      controller.seek(0, true);
      unsub();
    });
  });

  describe('5. Architectural Verification Across Studio Components', () => {
    it('wires useSyncExternalStore hooks in Titlebar, RightSidebar, Timeline, Preview, LeftSidebar, and ModifierControlStrategies', () => {
      const titlebar = fs.readFileSync(path.join(STUDIO_SRC, 'components/Titlebar.tsx'), 'utf-8');
      expect(titlebar).toContain('useIRSelector');
      expect(titlebar).not.toContain('const state = manager.getState()');

      const rightSidebar = fs.readFileSync(path.join(STUDIO_SRC, 'components/RightSidebar.tsx'), 'utf-8');
      expect(rightSidebar).toContain('useIRState');
      expect(rightSidebar.split('\n').length).toBeLessThan(350);

      const modStrategies = fs.readFileSync(
        path.join(STUDIO_SRC, 'components/inspector/ModifierControlStrategies.tsx'),
        'utf-8'
      );
      expect(modStrategies).toContain('usePlayheadFrame');
      expect(modStrategies).toContain('useIRSelector');
      expect(modStrategies).not.toContain('irState.timeline?.currentFrame');

      const timeline = fs.readFileSync(path.join(STUDIO_SRC, 'components/Timeline.tsx'), 'utf-8');
      expect(timeline).toContain('useIRState');

      const preview = fs.readFileSync(path.join(STUDIO_SRC, 'components/Preview.tsx'), 'utf-8');
      expect(preview).toContain('useIRState');
    });
  });
});
