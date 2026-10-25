import { describe, test, expect, beforeEach } from 'bun:test';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { analyzeVideoIRJson } from '../apps/studio/src/components/debugger/VisualIRJsonDebuggerModal';

describe('Visual VideoIR JSON Editor & Live Debugger Round-Trip', () => {
  const manager = IRStateManager.getInstance();

  beforeEach(async () => {
    await manager.switchTemplate('scifi');
  });

  test('analyzeVideoIRJson validates the active 12-track Sci-Fi Cyberpunk VideoIR with zero errors', () => {
    const jsonStr = manager.exportJSON();
    const { parsedDoc, diagnostics } = analyzeVideoIRJson(jsonStr);

    expect(parsedDoc).not.toBeNull();
    expect(diagnostics.parseError).toBeNull();
    expect(diagnostics.schemaValidation.valid).toBe(true);
    expect(diagnostics.trackCount).toBe(12);
    expect(diagnostics.sequenceCount).toBeGreaterThanOrEqual(16);
    expect(diagnostics.danglingAnchors.length).toBe(0);
    expect(diagnostics.missingAssets.length).toBe(0);
  });

  test('analyzeVideoIRJson detects syntax errors, schema violations, and dangling relational anchors', () => {
    // 1. Syntax error
    const badSyntax = analyzeVideoIRJson('{ "version": "1.0.0", broken_json ');
    expect(badSyntax.parsedDoc).toBeNull();
    expect(badSyntax.diagnostics.parseError).not.toBeNull();
    expect(badSyntax.diagnostics.schemaValidation.valid).toBe(false);

    // 2. Dangling relational anchor
    const doc = JSON.parse(manager.exportJSON());
    doc.tracks[0].sequences[1].time.start = {
      type: 'after',
      referenceId: 'seq-non-existent-ghost',
      offsetFrames: 10,
    };
    const danglingReport = analyzeVideoIRJson(JSON.stringify(doc));
    expect(danglingReport.diagnostics.danglingAnchors.length).toBe(1);
    expect(danglingReport.diagnostics.danglingAnchors[0].referenceId).toBe('seq-non-existent-ghost');
  });

  test('IRStateManager.applyJSONEdit applies valid JSON changes and supports undo/redo via ReplaceDocumentCommand', () => {
    const initialTitle = manager.getState().doc.metadata?.title;
    const raw = JSON.parse(manager.exportJSON());
    raw.metadata = {
      ...raw.metadata,
      title: 'DEBUGGER_LIVE_PATCHED_TITLE',
    };

    const result = manager.applyJSONEdit(JSON.stringify(raw, null, 2));
    expect(result.valid).toBe(true);
    expect(manager.getState().doc.metadata?.title).toBe('DEBUGGER_LIVE_PATCHED_TITLE');
    expect(manager.canUndo()).toBe(true);

    // Undo restores previous document
    manager.undo();
    expect(manager.getState().doc.metadata?.title).toBe(initialTitle);

    // Redo re-applies JSON edit
    manager.redo();
    expect(manager.getState().doc.metadata?.title).toBe('DEBUGGER_LIVE_PATCHED_TITLE');
  });
});
