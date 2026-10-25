import { describe, it, expect, beforeEach } from 'bun:test';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';

describe('Studio Timeline Client-Side State & Patching Suite', () => {
  const manager = IRStateManager.getInstance();

  beforeEach(async () => {
    await manager.switchTemplate('default');
  });

  it('should return compiled timeline state and playhead', () => {
    const state = manager.getState();
    expect(state.doc.meta.contentId).toBeDefined();
    expect(state.timeline?.totalFrames).toBeGreaterThan(0);
    expect(manager.canUndo()).toBe(false);
  });

  it('should update sequence modifier and support undo', () => {
    const state = manager.getState();
    const firstSeqId = state.doc.tracks[0]?.sequences[0]?.id;
    expect(firstSeqId).toBeDefined();

    manager.updateModifier(firstSeqId!, 'vfx/color_grading', {
      contrast: 1.5,
      saturation: 1.8,
    });

    expect(manager.canUndo()).toBe(true);

    manager.undo();
    expect(manager.canRedo()).toBe(true);

    manager.redo();
    expect(manager.canUndo()).toBe(true);
  });

  it('should trim sequence and recompile timeline', () => {
    const state = manager.getState();
    const firstSeqId = state.doc.tracks[0]?.sequences[0]?.id;
    expect(firstSeqId).toBeDefined();

    manager.trimSequence(firstSeqId!, 5, -5);
    expect(manager.canUndo()).toBe(true);

    manager.undo();
    expect(manager.canUndo()).toBe(false);
  });
});
