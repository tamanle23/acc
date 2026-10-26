import { describe, it, expect, beforeEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { MoveSequenceCommand } from '../apps/studio/src/lib/commands/MoveSequenceCommand';

describe('Phase 9: Unified @dnd-kit Architecture & State Management Suite', () => {
  const manager = IRStateManager.getInstance();

  beforeEach(async () => {
    await manager.switchTemplate('default');
  });

  describe('1. MoveSequenceCommand & Multi-Track Sequence Migration', () => {
    it('shifts sequence timing cleanly and recovers state on undo', () => {
      const state = manager.getState();
      const seq = state.doc.tracks[0].sequences[0];
      const initialStart = typeof seq.time.start === 'number' ? seq.time.start : 0;

      manager.moveSequence(seq.id, state.doc.tracks[0].id, initialStart + 30);
      const movedSeq = manager.getState().doc.tracks[0].sequences.find((s) => s.id === seq.id);
      expect(movedSeq?.time.start).toBe(initialStart + 30);
      expect(manager.canUndo()).toBe(true);

      manager.undo();
      const restoredSeq = manager.getState().doc.tracks[0].sequences.find((s) => s.id === seq.id);
      expect(restoredSeq?.time.start).toBe(initialStart);
    });

    it('moves sequence from video track to another track with undo restoration', () => {
      const state = manager.getState();
      const sourceTrack = state.doc.tracks[0];
      const targetTrack = state.doc.tracks[1];
      const seq = sourceTrack.sequences[0];

      manager.moveSequence(seq.id, targetTrack.id, 90);
      const afterMove = manager.getState();
      expect(afterMove.doc.tracks[0].sequences.some((s) => s.id === seq.id)).toBe(false);
      expect(afterMove.doc.tracks[1].sequences.some((s) => s.id === seq.id)).toBe(true);

      manager.undo();
      const afterUndo = manager.getState();
      expect(afterUndo.doc.tracks[0].sequences.some((s) => s.id === seq.id)).toBe(true);
      expect(afterUndo.doc.tracks[1].sequences.some((s) => s.id === seq.id)).toBe(false);
    });

    it('merges rapid successive move commands into a single undo frame', () => {
      const state = manager.getState();
      const trackId = state.doc.tracks[0].id;
      const seqId = state.doc.tracks[0].sequences[0].id;

      const cmd1 = new MoveSequenceCommand(seqId, trackId, 10);
      const cmd2 = new MoveSequenceCommand(seqId, trackId, 25);
      const merged = cmd1.tryMerge(cmd2);
      expect(merged).toBe(true);

      const res = cmd1.execute(state.doc);
      const updatedSeq = res.tracks[0].sequences.find((s) => s.id === seqId);
      expect(updatedSeq?.time.start).toBe(25);
    });
  });

  describe('2. Timeline.tsx @dnd-kit Component Architecture', () => {
    it('verifies Timeline.tsx implements declarative @dnd-kit draggables and droppables without window mousemove listeners', () => {
      const timelineDir = path.join(__dirname, '../apps/studio/src/components/timeline');
      const timelineCoordinator = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/Timeline.tsx'),
        'utf-8'
      );
      // Task 302: Timeline.tsx was decomposed — useDraggable lives in TimelineClipItem.tsx / TrimHandle.tsx
      const subFiles = fs.readdirSync(timelineDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
      const timelineCode = [
        timelineCoordinator,
        ...subFiles.map(f => fs.readFileSync(path.join(timelineDir, f), 'utf-8')),
      ].join('\n');

      // Verify @dnd-kit imports & hooks (across coordinator + submodules)
      expect(timelineCode).toContain("from '@dnd-kit/core'");
      expect(timelineCode).toContain('useDraggable');
      expect(timelineCode).toContain('useDroppable');
      expect(timelineCode).toContain('DndContext');

      // Verify sub-components
      expect(timelineCode).toContain('DroppableTrackLane');
      expect(timelineCode).toContain('TimelineClipItem');
      expect(timelineCode).toContain('TrimHandle');

      // Verify activation constraint to protect razor/click interactions
      expect(timelineCode).toContain('activationConstraint');
      expect(timelineCode).toContain('timelineSensors');

      // Verify drag handlers
      expect(timelineCode).toContain('handleDragStart');
      expect(timelineCode).toContain('handleDragMove');
      expect(timelineCode).toContain('handleDragEnd');

      // Ensure manual mousemove listener boilerplate is completely removed
      expect(timelineCode).not.toContain("window.addEventListener('mousemove'");
    });
  });

  describe('3. Preview.tsx @dnd-kit Transform Architecture', () => {
    it('verifies Preview.tsx implements declarative @dnd-kit transform overlay without manual window listeners', () => {
      const previewDir = path.join(__dirname, '../apps/studio/src/components/preview');
      const previewCoordinator = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/Preview.tsx'),
        'utf-8'
      );
      const subFiles = fs.readdirSync(previewDir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
      const previewCode = [
        previewCoordinator,
        ...subFiles.map((f) => fs.readFileSync(path.join(previewDir, f), 'utf-8')),
      ].join('\n');

      // Verify @dnd-kit sub-components
      expect(previewCode).toContain('TransformBodyDraggable');
      expect(previewCode).toContain('TransformHandle');

      // Verify transform sensors with activation constraint
      expect(previewCode).toContain('transformSensors');
      expect(previewCode).toContain('activationConstraint');

      // Verify transform drag handlers
      expect(previewCode).toContain('handleTransformDragStart');
      expect(previewCode).toContain('handleTransformDragMove');
      expect(previewCode).toContain('handleTransformDragEnd');

      // Ensure computeDragTransform is wired to onDragMove
      expect(previewCode).toContain('computeDragTransform');

      // Ensure window mouseup cleanup boilerplate is gone
      expect(previewCode).not.toContain("window.addEventListener('mouseup', handleGlobalMouseUp)");
    });
  });
});
