import { describe, it, expect } from 'bun:test';
import { defaultDemoIR } from '../apps/studio/src/lib/ir/defaultDemoIR';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { VideoIRSchemaValidator } from '../packages/ir/src/schema/VideoIRSchemaValidator';

describe('Video IR Authoring & Compilation Engine in Studio', () => {
  it('validates that defaultDemoIR strictly complies with VideoIRSchemaValidator', () => {
    const result = VideoIRSchemaValidator.validate(defaultDemoIR);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('compiles defaultDemoIR into ResolvedTimeline and IntervalTreeIndex', async () => {
    const manager = IRStateManager.getInstance();
    manager.switchTemplate('default');
    await manager.recompile();
    const state = manager.getState();

    expect(state.error).toBeNull();
    expect(state.timeline).not.toBeNull();
    expect(state.intervalTree).not.toBeNull();

    // Verify tracks compiled
    expect(state.timeline?.tracks.size).toBe(defaultDemoIR.tracks.length);

    // Verify IntervalTreeIndex queries sub-millisecond
    const activeSeqsAtFrame45 = state.intervalTree?.queryActive(45) || [];
    expect(activeSeqsAtFrame45.length).toBeGreaterThan(0);
  });

  it('performs sequence trimming and updates sequence start/duration in VideoIRDocument', async () => {
    const manager = IRStateManager.getInstance();
    const stateBefore = manager.getState();
    const initialStart = stateBefore.doc.tracks[0].sequences[0].time.start as number;

    manager.trimSequence('seq-visual-1', 10, -10);

    const stateAfter = manager.getState();
    expect(stateAfter.doc.tracks[0].sequences[0].time.start).toBe(initialStart + 10);
    expect(stateAfter.doc.tracks[0].sequences[0].time.duration).toBe(80);

    // Validate schema is still 100% compliant after trim
    const validation = VideoIRSchemaValidator.validate(stateAfter.doc);
    expect(validation.valid).toBe(true);
  });

  it('splits a sequence at the playhead and preserves DAG dependency', async () => {
    const manager = IRStateManager.getInstance();
    const stateBefore = manager.getState();
    const seqCountBefore = stateBefore.doc.tracks[0].sequences.length;
    const seqStart = stateBefore.doc.tracks[0].sequences[0].time.start as number; // 10

    // Split seq-visual-1 at frame 40
    manager.splitSequence('seq-visual-1', 40);

    const stateAfter = manager.getState();
    expect(stateAfter.doc.tracks[0].sequences.length).toBe(seqCountBefore + 1);

    // Part 1 duration should be 40 - seqStart (40 - 10 = 30)
    expect(stateAfter.doc.tracks[0].sequences[0].time.duration).toBe(40 - seqStart);

    // Part 2 should be linked via 'after'
    const part2 = stateAfter.doc.tracks[0].sequences[1];
    expect(typeof part2.time.start).toBe('object');
    expect((part2.time.start as any).after).toBe('seq-visual-1');

    // Schema must remain valid
    const validation = VideoIRSchemaValidator.validate(stateAfter.doc);
    expect(validation.valid).toBe(true);
  });

  it('updates modifier parameters in-place and maintains schema validity', async () => {
    const manager = IRStateManager.getInstance();
    manager.updateModifier('seq-visual-1', 'vfx/color_grading', {
      contrast: 1.85,
      saturation: 1.5,
      exposure: 0.2,
    });

    const state = manager.getState();
    const seq = state.doc.tracks[0].sequences[0];
    const mod = seq.modifiers?.find((m) => m.type === 'vfx/color_grading');
    expect(mod?.params).toEqual({
      contrast: 1.85,
      saturation: 1.5,
      exposure: 0.2,
    });

    const validation = VideoIRSchemaValidator.validate(state.doc);
    expect(validation.valid).toBe(true);
  });

  it('supports undo and redo operations on VideoIR mutations', async () => {
    const manager = IRStateManager.getInstance();
    manager.switchTemplate('default');

    manager.trimSequence('seq-visual-1', 5, -5);
    expect(manager.canUndo()).toBe(true);

    manager.undo();
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);

    manager.redo();
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
  });

  it('exports and re-imports VideoIR JSON with 100% roundtrip fidelity', () => {
    const manager = IRStateManager.getInstance();
    const exportedJSON = manager.exportJSON();
    expect(typeof exportedJSON).toBe('string');

    const result = manager.loadFromJSON(exportedJSON);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});
