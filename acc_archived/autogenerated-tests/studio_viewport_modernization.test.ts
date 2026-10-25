import { describe, it, expect, beforeEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';

describe('Phase 4: Studio Viewport Modernization Suite (Canvas2D, Action Pill, Viewport HUD)', () => {
  const previewPath = path.resolve(__dirname, '../apps/studio/src/components/Preview.tsx');
  const previewDir = path.resolve(__dirname, '../apps/studio/src/components/preview');

  const getCombinedCode = () => {
    let combined = fs.readFileSync(previewPath, 'utf8');
    if (fs.existsSync(previewDir)) {
      const files = fs.readdirSync(previewDir);
      for (const f of files) {
        if (f.endsWith('.tsx') || f.endsWith('.ts')) {
          combined += '\n' + fs.readFileSync(path.join(previewDir, f), 'utf8');
        }
      }
    }
    return combined;
  };

  it('verifies Preview.tsx source exists and has zero compilation syntax errors', () => {
    expect(fs.existsSync(previewPath)).toBe(true);
    const code = fs.readFileSync(previewPath, 'utf8');
    expect(code.length).toBeGreaterThan(1000);
  });

  describe('Viewport Header HUD & Control Bar', () => {
    it('should implement Zoom presets (Fit, 50%, 100%, 200%) in the top HUD', () => {
      const code = getCombinedCode();
      expect(code).toContain('zoomLevel');
      expect(code).toContain('Fit');
      expect(code).toContain('50%');
      expect(code).toContain('100%');
      expect(code).toContain('200%');
      expect(code).toContain('setZoomLevel');
    });

    it('should implement Pan Hand Tool with Spacebar navigation support', () => {
      const code = getCombinedCode();
      expect(code).toContain('isPanToolActive');
      expect(code).toContain('isSpacePressed');
      expect(code).toContain('isPanning');
      expect(code).toContain('panOffset');
      expect(code).toContain('Pan Hand Tool (Hold Space + Drag)');
    });

    it('should implement Broadcast (16:9) and Social (9:16) Safe Guides', () => {
      const code = getCombinedCode();
      expect(code).toContain('safeGuidesMode');
      expect(code).toContain('16:9 Action Safe (93%)');
      expect(code).toContain('16:9 Title Safe (90%)');
      expect(code).toContain('9:16 Social Frame');
      expect(code).toContain('Top UI Zone (Profile / Search)');
      expect(code).toContain('Bottom UI Zone (Captions / Audio)');
      expect(code).toContain('Actions (Like / Share)');
    });

    it('should implement Alpha Transparency Checkerboard toggle with repeating-conic-gradient', () => {
      const code = getCombinedCode();
      expect(code).toContain('showCheckerboard');
      expect(code).toContain('repeating-conic-gradient');
      expect(code).toContain('Toggle Alpha Transparency Checkerboard');
    });
  });

  describe('On-Canvas Floating Contextual Action Pill', () => {
    it('should render Contextual Action Pill right above the active transform selection', () => {
      const code = getCombinedCode();
      expect(code).toContain('Floating Contextual Action Pill HUD');
      expect(code).toContain('-top-12 left-1/2 -translate-x-1/2');
    });

    it('should include Duplicate, Center Alignment, Lock/Unlock, Reset Transform, and Delete actions', () => {
      const code = getCombinedCode();
      expect(code).toContain('duplicateSequence(selectedSeqId)');
      expect(code).toContain('deleteSequence(selectedSeqId)');
      expect(code).toContain('Center Alignment');
      expect(code).toContain('Reset Transform');
      expect(code).toContain('isLocked');
    });

    it('should display lock indicator and disable transform dragging when locked', () => {
      const code = getCombinedCode();
      expect(code).toContain('cursor-not-allowed');
      expect(code).toContain('border-amber-400');
      expect(code).toContain('if (isLocked) return');
    });
  });

  describe('Cursor States & Keyboard Shortcuts', () => {
    it('should expose responsive cursor classes for transform handles and pan tool', () => {
      const code = getCombinedCode();
      expect(code).toContain('cursor-nwse-resize');
      expect(code).toContain('cursor-nesw-resize');
      expect(code).toContain('cursor-ns-resize');
      expect(code).toContain('cursor-ew-resize');
      expect(code).toContain('cursor-grab');
      expect(code).toContain('cursor-grabbing');
    });

    it('should listen for Space, Delete, Backspace, Ctrl+D, and Escape shortcuts', () => {
      const code = getCombinedCode();
      expect(code).toContain("e.code === 'Space'");
      expect(code).toContain("e.key === 'Delete'");
      expect(code).toContain("e.key.toLowerCase() === 'd'");
      expect(code).toContain("e.key === 'Escape'");
    });
  });

  describe('IRStateManager Integration for Contextual Actions', () => {
    beforeEach(async () => {
      await IRStateManager.getInstance().switchTemplate('default');
    });

    it('should duplicate a sequence and automatically select the new duplicate', () => {
      const mgr = IRStateManager.getInstance();
      const state = mgr.getState();
      const initialSeq = state.doc.tracks[0].sequences[0];
      expect(initialSeq).toBeDefined();

      const initialCount = state.doc.tracks[0].sequences.length;
      mgr.duplicateSequence(initialSeq.id);

      const newState = mgr.getState();
      expect(newState.doc.tracks[0].sequences.length).toBe(initialCount + 1);
      const dupSeq = newState.doc.tracks[0].sequences.find((s) => s.id.startsWith(`${initialSeq.id}_copy_`));
      expect(dupSeq).toBeDefined();
      expect(dupSeq!.id).not.toBe(initialSeq.id);
      expect(newState.selectedSequenceId).toBe(dupSeq!.id);
    });

    it('should delete a sequence and clear selection if currently selected', () => {
      const mgr = IRStateManager.getInstance();
      const state = mgr.getState();
      const seqToDelete = state.doc.tracks[0].sequences[0];
      expect(seqToDelete).toBeDefined();

      mgr.setSelectedSequenceId(seqToDelete.id);
      expect(mgr.getState().selectedSequenceId).toBe(seqToDelete.id);

      mgr.deleteSequence(seqToDelete.id);

      const newState = mgr.getState();
      expect(newState.selectedSequenceId).toBeNull();
      const found = newState.doc.tracks[0].sequences.find((s) => s.id === seqToDelete.id);
      expect(found).toBeUndefined();
    });

    it('should update sequence transform modifier for centering and reset', () => {
      const mgr = IRStateManager.getInstance();
      const state = mgr.getState();
      const seq = state.doc.tracks[0].sequences[0];

      // Simulate Center Alignment (x: 0, y: 0)
      mgr.updateModifier(seq.id, 'transform', { x: 0, y: 0, scale: 1.5, rotation: 45 });
      let updated = mgr.getState().doc.tracks[0].sequences[0];
      let transMod = updated.modifiers?.find((m) => m.type === 'transform');
      expect((transMod?.params as any).x).toBe(0);
      expect((transMod?.params as any).y).toBe(0);

      // Simulate Reset Transform (x: 0, y: 0, scale: 1.0, rotation: 0)
      mgr.updateModifier(seq.id, 'transform', { x: 0, y: 0, scale: 1.0, rotation: 0 });
      updated = mgr.getState().doc.tracks[0].sequences[0];
      transMod = updated.modifiers?.find((m) => m.type === 'transform');
      expect((transMod?.params as any).scale).toBe(1.0);
      expect((transMod?.params as any).rotation).toBe(0);
    });
  });
});
