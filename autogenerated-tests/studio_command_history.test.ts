import { describe, it, expect } from 'bun:test';
import { HistoryManager, CoalescingHistoryStrategy } from '../apps/studio/src/lib/commands/HistoryManager';
import { TrimSequenceCommand } from '../apps/studio/src/lib/commands/TrimSequenceCommand';
import { SplitSequenceCommand } from '../apps/studio/src/lib/commands/SplitSequenceCommand';
import { UpdateModifierCommand } from '../apps/studio/src/lib/commands/UpdateModifierCommand';
import { defaultDemoIR } from '../apps/studio/src/lib/ir/defaultDemoIR';
import type { VideoIRDocument } from '@acc/ir/client';

describe('Studio Command & History Strategy Pattern (Phase 5 Ext)', () => {
  it('executes TrimSequenceCommand and reverses cleanly with undo', () => {
    const manager = new HistoryManager();
    const doc: VideoIRDocument = JSON.parse(JSON.stringify(defaultDemoIR));
    const initialStart = doc.tracks[0].sequences[0].time.start as number; // 0

    const cmd = new TrimSequenceCommand('seq-visual-1', 15, -15);
    const updatedDoc = manager.execute(cmd, doc);

    expect(updatedDoc.tracks[0].sequences[0].time.start).toBe(initialStart + 15);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);

    // Rollback via Undo
    const rolledBackDoc = manager.undo(updatedDoc)!;
    expect(rolledBackDoc.tracks[0].sequences[0].time.start).toBe(initialStart);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);

    // Replay via Redo
    const replayedDoc = manager.redo(rolledBackDoc)!;
    expect(replayedDoc.tracks[0].sequences[0].time.start).toBe(initialStart + 15);
  });

  it('coalesces rapid continuous modifier adjustments into a single undo step', () => {
    const manager = new HistoryManager(new CoalescingHistoryStrategy(50, 1000));
    let doc: VideoIRDocument = JSON.parse(JSON.stringify(defaultDemoIR));

    // Simulate user dragging contrast slider rapidly
    const cmd1 = new UpdateModifierCommand('seq-visual-1', 'vfx/color_grading', { contrast: 1.1 });
    doc = manager.execute(cmd1, doc);

    const cmd2 = new UpdateModifierCommand('seq-visual-1', 'vfx/color_grading', { contrast: 1.25 });
    doc = manager.execute(cmd2, doc);

    const cmd3 = new UpdateModifierCommand('seq-visual-1', 'vfx/color_grading', { contrast: 1.5 });
    doc = manager.execute(cmd3, doc);

    // Because of coalescing, undo stack depth should be 1
    expect(manager.getUndoCount()).toBe(1);

    // Modifier params should reflect final value
    const mod = doc.tracks[0].sequences[0].modifiers?.find((m) => m.type === 'vfx/color_grading');
    expect((mod?.params as any).contrast).toBe(1.5);

    // A single undo should roll back to initial state before dragging began
    doc = manager.undo(doc)!;
    const restoredMod = doc.tracks[0].sequences[0].modifiers?.find((m) => m.type === 'vfx/color_grading');
    expect((restoredMod?.params as any).contrast).toBe(1.15); // initial default in defaultDemoIR
  });

  it('clears redo stack upon new execution after undo (branching integrity)', () => {
    const manager = new HistoryManager();
    let doc: VideoIRDocument = JSON.parse(JSON.stringify(defaultDemoIR));

    const cmd1 = new TrimSequenceCommand('seq-visual-1', 10, -10);
    doc = manager.execute(cmd1, doc);

    doc = manager.undo(doc)!;
    expect(manager.canRedo()).toBe(true);

    // New action performed
    const cmd2 = new TrimSequenceCommand('seq-visual-1', 20, -20);
    doc = manager.execute(cmd2, doc);

    // Redo must be purged
    expect(manager.canRedo()).toBe(false);
    expect(manager.getUndoCount()).toBe(1);
  });

  it('evicts oldest commands when exceeding maxDepth policy', () => {
    const manager = new HistoryManager(new CoalescingHistoryStrategy(3, 0)); // maxDepth = 3, no coalesce
    let doc: VideoIRDocument = JSON.parse(JSON.stringify(defaultDemoIR));

    manager.execute(new TrimSequenceCommand('seq-visual-1', 1, 0), doc);
    manager.execute(new TrimSequenceCommand('seq-visual-1', 2, 0), doc);
    manager.execute(new TrimSequenceCommand('seq-visual-1', 3, 0), doc);
    manager.execute(new TrimSequenceCommand('seq-visual-1', 4, 0), doc);

    expect(manager.getUndoCount()).toBe(3);
  });

  it('splits sequence and cleanly restores original sequence with undo', () => {
    const manager = new HistoryManager();
    let doc: VideoIRDocument = JSON.parse(JSON.stringify(defaultDemoIR));
    const initialSeqCount = doc.tracks[0].sequences.length;

    const cmd = new SplitSequenceCommand('seq-visual-1', 45, 0, 90);
    doc = manager.execute(cmd, doc);

    expect(doc.tracks[0].sequences.length).toBe(initialSeqCount + 1);

    // Undo split
    doc = manager.undo(doc)!;
    expect(doc.tracks[0].sequences.length).toBe(initialSeqCount);
    expect(doc.tracks[0].sequences[0].time.duration).toBe(90);
  });
});
