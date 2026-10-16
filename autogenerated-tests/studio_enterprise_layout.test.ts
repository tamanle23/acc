import { describe, it, expect, beforeEach } from 'bun:test';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { DuplicateSequenceCommand } from '../apps/studio/src/lib/commands/DuplicateSequenceCommand';
import { DeleteSequenceCommand } from '../apps/studio/src/lib/commands/DeleteSequenceCommand';
import { STAGING_PRESETS } from '../apps/studio/src/lib/library/stagingPresets';
import { VideoIRSchemaValidator } from '@acc/ir/client';

describe('Studio Enterprise Layout & NLE Action Suite', () => {
  let manager: IRStateManager;

  beforeEach(async () => {
    manager = IRStateManager.getInstance();
    await manager.switchTemplate('scifi');
  });

  describe('DuplicateSequenceCommand & Undo/Redo Fidelity', () => {
    it('should clone an existing sequence, adjust name and ID, and recompile DAG cleanly', async () => {
      const stateBefore = manager.getState();
      const origSeqId = 'seq-city-intro';
      const origSeq = stateBefore.timeline?.sequences?.get(origSeqId);
      expect(origSeq).toBeDefined();

      const origTrack = stateBefore.doc.tracks.find((t) => t.sequences.some((s) => s.id === origSeqId));
      expect(origTrack).toBeDefined();
      const initialCount = origTrack!.sequences.length;

      // Execute duplication
      manager.duplicateSequence(origSeqId);
      await manager.recompile();

      const stateAfter = manager.getState();
      const dupSeqId = stateAfter.selectedSequenceId;
      expect(dupSeqId).not.toBeNull();
      expect(dupSeqId).toContain('seq-city-intro_copy_');

      const dupSeq = stateAfter.timeline?.sequences?.get(dupSeqId!);
      expect(dupSeq).toBeDefined();

      const updatedTrack = stateAfter.doc.tracks.find((t) => t.id === origTrack!.id);
      expect(updatedTrack!.sequences.length).toBe(initialCount + 1);
      const docSeq = updatedTrack!.sequences.find((s) => s.id === dupSeqId);
      expect(docSeq).toBeDefined();
      expect(docSeq!.name).toContain('(Copy)');

      // Verify VideoIR Draft-07 schema compliance
      const val = VideoIRSchemaValidator.validate(stateAfter.doc);
      expect(val.valid).toBe(true);

      // Undo duplication
      manager.undo();
      await manager.recompile();
      const stateUndo = manager.getState();
      const trackUndo = stateUndo.doc.tracks.find((t) => t.id === origTrack!.id);
      expect(trackUndo!.sequences.length).toBe(initialCount);
      expect(stateUndo.timeline?.sequences?.has(dupSeqId!)).toBe(false);

      // Redo duplication
      manager.redo();
      await manager.recompile();
      const stateRedo = manager.getState();
      const trackRedo = stateRedo.doc.tracks.find((t) => t.id === origTrack!.id);
      expect(trackRedo!.sequences.length).toBe(initialCount + 1);
      expect(stateRedo.timeline?.sequences?.has(dupSeqId!)).toBe(true);
    });
  });

  describe('DeleteSequenceCommand & 100% Recovery via Undo', () => {
    it('should delete sequence from track and restore original index and metadata upon undo', async () => {
      const stateBefore = manager.getState();
      const targetSeqId = 'seq-pilot-comm';
      const targetTrack = stateBefore.doc.tracks.find((t) => t.sequences.some((s) => s.id === targetSeqId));
      expect(targetTrack).toBeDefined();
      const origIndex = targetTrack!.sequences.findIndex((s) => s.id === targetSeqId);
      const origLength = targetTrack!.sequences.length;

      // Execute deletion
      manager.deleteSequence(targetSeqId);
      await manager.recompile();

      const stateAfter = manager.getState();
      const updatedTrack = stateAfter.doc.tracks.find((t) => t.id === targetTrack!.id);
      expect(updatedTrack!.sequences.length).toBe(origLength - 1);
      expect(updatedTrack!.sequences.some((s) => s.id === targetSeqId)).toBe(false);
      expect(stateAfter.selectedSequenceId).not.toBe(targetSeqId);

      // Verify schema validity after deletion
      const val = VideoIRSchemaValidator.validate(stateAfter.doc);
      expect(val.valid).toBe(true);

      // Undo deletion
      manager.undo();
      await manager.recompile();
      const stateUndo = manager.getState();
      const restoredTrack = stateUndo.doc.tracks.find((t) => t.id === targetTrack!.id);
      expect(restoredTrack!.sequences.length).toBe(origLength);
      expect(restoredTrack!.sequences[origIndex].id).toBe(targetSeqId);
    });
  });

  describe('Enterprise Staging Presets Catalog & dnd-kit Metadata', () => {
    it('should provide complete metadata and valid sequence generators for all 12 presets', () => {
      expect(STAGING_PRESETS.length).toBe(12);

      for (const preset of STAGING_PRESETS) {
        expect(preset.id).toBeTruthy();
        expect(preset.name).toBeTruthy();
        expect(preset.category).toBeTruthy();
        expect(['text', 'shape', 'vfx']).toContain(preset.category);
        expect(preset.targetTrackId).toBeTruthy();

        const seq = preset.createSequence({ startFrame: 15, normX: 0.3, normY: 0.7 });
        expect(seq.id).toBeTruthy();
        expect(seq.time.start).toBe(15);
        expect(seq.modifiers).toBeDefined();
      }
    });
  });
});
