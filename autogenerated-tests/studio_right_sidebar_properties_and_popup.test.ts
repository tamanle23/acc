import { describe, it, expect, beforeEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState.js';

describe('Iteration 78: RightSidebar Property Modifications and Sequence Preview Popup Positioning', () => {
  beforeEach(async () => {
    await IRStateManager.getInstance().switchTemplate('scifi');
  });

  it('HoverCardTrigger should not apply display: contents or class="contents"', () => {
    const hoverCardPath = join(process.cwd(), 'apps/studio/src/components/ui/hover-card.tsx');
    const code = readFileSync(hoverCardPath, 'utf-8');

    // Verify 'contents' class is eliminated
    expect(code).not.toContain('local.asChild && "contents"');
    expect(code).not.toContain('"contents"');
    expect(code).toContain('as={local.as ?? "div"}');
  });

  it('ClipHoverHUD should bind HoverCardTrigger directly to the clip with physical coordinates', () => {
    const hudPath = join(process.cwd(), 'apps/studio/src/components/timeline/ClipHoverHUD.tsx');
    const hudCode = readFileSync(hudPath, 'utf-8');

    expect(hudCode).toContain('HoverCardTrigger');
    expect(hudCode).toContain('HoverCardContent');
    expect(hudCode).toContain('ClipInsightCard');
    expect(hudCode).toContain('side="top"');
    expect(hudCode).toContain('sideOffset={8}');
    expect(hudCode).toContain('{...triggerProps}');
  });

  it('ClipItem should forward physical timeline positioning and draggable ref to ClipHoverHUD', () => {
    const clipItemPath = join(process.cwd(), 'apps/studio/src/components/timeline/ClipItem.tsx');
    const clipCode = readFileSync(clipItemPath, 'utf-8');

    expect(clipCode).toContain('<ClipHoverHUD');
    expect(clipCode).toContain('draggable.ref(el)');
    expect(clipCode).toContain('left: `${leftPx()}px`');
    expect(clipCode).toContain('width: `${widthPx()}px`');
  });

  it('SequenceInspector should use <Index> for dynamic modifiers to preserve DOM focus & pointer capture', () => {
    const inspectorPath = join(process.cwd(), 'apps/studio/src/components/inspector/SequenceInspector.tsx');
    const code = readFileSync(inspectorPath, 'utf-8');

    expect(code).toContain('<Index each={filteredModifiers()}>');
    expect(code).not.toContain('<For each={filteredModifiers()}>');
    expect(code).toContain('DynamicModifierInspector');
  });

  it('DynamicModifierInspector should reconcile fields by stable string keys', () => {
    const dynPath = join(process.cwd(), 'apps/studio/src/components/inspector/DynamicModifierInspector.tsx');
    const dynCode = readFileSync(dynPath, 'utf-8');

    expect(dynCode).toContain('schemaFieldKeys');
    expect(dynCode).toContain('<For each={schemaFieldKeys()}>');
    expect(dynCode).toContain('resolveParamControlStrategy');
  });

  it('IRStateManager should modify sequence timing and recompile DAG with zero errors', async () => {
    const manager = IRStateManager.getInstance();
    const seqId = 'seq-city-intro';

    manager.updateSequenceProps(seqId, {
      time: { start: 45, duration: 150 },
    });

    const state = manager.getState();
    const seq = state.doc.tracks[0].sequences.find((s) => s.id === seqId);
    expect(seq).toBeDefined();
    expect(seq?.time.start).toBe(45);
    expect(seq?.time.duration).toBe(150);
    expect(state.error).toBeNull();
  });

  it('IRStateManager should modify modifier parameters cleanly without dropping sequence properties', async () => {
    const manager = IRStateManager.getInstance();
    const seqId = 'seq-city-intro';

    manager.updateModifier(seqId, 'transform', {
      x: 120,
      y: -80,
      scale: 1.25,
      rotation: 45,
      opacity: 0.85,
    });

    const state = manager.getState();
    const seq = state.doc.tracks[0].sequences.find((s) => s.id === seqId);
    const mod = seq?.modifiers?.find((m) => m.type === 'transform');

    expect(mod).toBeDefined();
    expect(mod?.params.x).toBe(120);
    expect(mod?.params.y).toBe(-80);
    expect(mod?.params.scale).toBe(1.25);
    expect(mod?.params.rotation).toBe(45);
    expect(mod?.params.opacity).toBe(0.85);
    expect(state.error).toBeNull();
  });
});
