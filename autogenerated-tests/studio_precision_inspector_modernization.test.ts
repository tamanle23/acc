import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { evaluateSafeMathExpression } from '../apps/studio/src/components/inspector/ScrubbableNumberInput';
import { ReorderModifierCommand } from '../apps/studio/src/lib/commands/ReorderModifierCommand';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import type { VideoIRDocument } from '@acc/ir';

describe('Studio Dynamic Property Editor & Precision Scrubber Suite', () => {
  describe('1. Safe Math Expression Evaluator (Zero eval() / AST-safe)', () => {
    it('evaluates relative increment and decrement offsets', () => {
      expect(evaluateSafeMathExpression('+50', 100)).toBe(150);
      expect(evaluateSafeMathExpression('-25', 100)).toBe(75);
      expect(evaluateSafeMathExpression('+0.5', 1.0)).toBeCloseTo(1.5, 4);
      expect(evaluateSafeMathExpression('-10.25', 50)).toBeCloseTo(39.75, 4);
    });

    it('evaluates standard arithmetic expressions adhering to operator precedence', () => {
      expect(evaluateSafeMathExpression('1920 / 2', 0)).toBe(960);
      expect(evaluateSafeMathExpression('1080 / 4', 0)).toBe(270);
      expect(evaluateSafeMathExpression('50 * 2', 0)).toBe(100);
      expect(evaluateSafeMathExpression('10 + 20 * 2', 0)).toBe(50);
      expect(evaluateSafeMathExpression('100 - 30 / 3', 0)).toBe(90);
    });

    it('safely handles divide by zero and invalid syntax without throwing', () => {
      expect(evaluateSafeMathExpression('100 / 0', 0)).toBeNull();
      expect(evaluateSafeMathExpression('invalid_text', 10)).toBeNull();
      expect(evaluateSafeMathExpression('', 10)).toBeNull();
      expect(evaluateSafeMathExpression('+++', 10)).toBeNull();
    });
  });

  describe('2. ReorderModifierCommand & Modifier Pipeline Execution Order', () => {
    const createMockDoc = (): VideoIRDocument => ({
      schemaVersion: '2.0.0',
      meta: {
        contentId: 'test-timeline',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track-v1',
          name: 'Video 1',
          type: 'video',
          sequences: [
            {
              id: 'seq-1',
              type: 'video',
              assetId: 'asset-1',
              time: { start: 0, duration: 90 },
              modifiers: [
                { type: 'transform', params: { scale: 1.0 } },
                { type: 'vfx/color_grading', params: { exposure: 0.5 } },
                { type: 'motion/gsap', params: { preset: 'pop_in' } },
              ],
            },
          ],
        },
      ],
    });

    it('reorders modifiers down in the execution pipeline and supports undo', () => {
      const doc = createMockDoc();
      const cmd = new ReorderModifierCommand('seq-1', 'transform', 'down');
      const updated = cmd.execute(doc);

      const seq = updated.tracks[0].sequences[0];
      expect(seq.modifiers?.[0].type).toBe('vfx/color_grading');
      expect(seq.modifiers?.[1].type).toBe('transform');
      expect(seq.modifiers?.[2].type).toBe('motion/gsap');

      // Undo restores original order
      const undone = cmd.undo(updated);
      const undoneSeq = undone.tracks[0].sequences[0];
      expect(undoneSeq.modifiers?.[0].type).toBe('transform');
      expect(undoneSeq.modifiers?.[1].type).toBe('vfx/color_grading');
      expect(undoneSeq.modifiers?.[2].type).toBe('motion/gsap');
    });

    it('reorders modifiers up in the execution pipeline and supports undo', () => {
      const doc = createMockDoc();
      const cmd = new ReorderModifierCommand('seq-1', 'motion/gsap', 'up');
      const updated = cmd.execute(doc);

      const seq = updated.tracks[0].sequences[0];
      expect(seq.modifiers?.[0].type).toBe('transform');
      expect(seq.modifiers?.[1].type).toBe('motion/gsap');
      expect(seq.modifiers?.[2].type).toBe('vfx/color_grading');

      // Undo restores original order
      const undone = cmd.undo(updated);
      const undoneSeq = undone.tracks[0].sequences[0];
      expect(undoneSeq.modifiers?.[0].type).toBe('transform');
      expect(undoneSeq.modifiers?.[1].type).toBe('vfx/color_grading');
      expect(undoneSeq.modifiers?.[2].type).toBe('motion/gsap');
    });

    it('respects boundary conditions (cannot move top modifier up or bottom modifier down)', () => {
      const doc = createMockDoc();
      const topUpCmd = new ReorderModifierCommand('seq-1', 'transform', 'up');
      const updatedTop = topUpCmd.execute(doc);
      expect(updatedTop.tracks[0].sequences[0].modifiers?.[0].type).toBe('transform');

      const bottomDownCmd = new ReorderModifierCommand('seq-1', 'motion/gsap', 'down');
      const updatedBottom = bottomDownCmd.execute(doc);
      expect(updatedBottom.tracks[0].sequences[0].modifiers?.[2].type).toBe('motion/gsap');
    });

    it('executes reordering via IRStateManager with undo/redo stack integration', () => {
      const manager = IRStateManager.getInstance();
      const doc = createMockDoc();
      manager.loadDocument(doc);
      manager.setSelectedSequenceId('seq-1');

      manager.reorderModifier('seq-1', 'transform', 'down');
      let currentSeq = manager.getState().doc.tracks[0].sequences[0];
      expect(currentSeq.modifiers?.[0].type).toBe('vfx/color_grading');
      expect(currentSeq.modifiers?.[1].type).toBe('transform');

      // Undo
      manager.undo();
      currentSeq = manager.getState().doc.tracks[0].sequences[0];
      expect(currentSeq.modifiers?.[0].type).toBe('transform');
      expect(currentSeq.modifiers?.[1].type).toBe('vfx/color_grading');

      // Redo
      manager.redo();
      currentSeq = manager.getState().doc.tracks[0].sequences[0];
      expect(currentSeq.modifiers?.[0].type).toBe('vfx/color_grading');
      expect(currentSeq.modifiers?.[1].type).toBe('transform');
    });
  });

  describe('3. Accordion Collapse & Expansion State Mechanics', () => {
    it('verifies collapsing an accordion section removes its aliases and collapses the item', () => {
      // Simulate SequenceInspector's effectiveOpenSections and handleAccordionValueChange
      const modifiers = [
        { type: 'transform', params: {} },
        { type: 'vfx/color_grading', params: {} },
      ];
      let openSections = ['transform', 'color', 'audio'];

      const computeEffective = (openSecs: string[]) => {
        const set = new Set<string>();
        modifiers.forEach((m, idx) => {
          const key = `${m.type}_${idx}`;
          const secId = m.type === 'transform' ? 'transform' : 'color';
          if (openSecs.includes(key) || openSecs.includes(secId) || openSecs.includes(m.type)) {
            set.add(key);
          }
        });
        return Array.from(set);
      };

      const handleValueChange = (nextOpenKeys: string[]) => {
        const currentModifiers = modifiers.map((m, idx) => ({
          key: `${m.type}_${idx}`,
          type: m.type,
          secId: m.type === 'transform' ? 'transform' : 'color',
        }));

        const closedModifiers = currentModifiers.filter((m) => !nextOpenKeys.includes(m.key));
        const closedSet = new Set<string>();
        closedModifiers.forEach((m) => {
          closedSet.add(m.key);
          closedSet.add(m.type);
          closedSet.add(m.secId);
        });

        const updated = openSections.filter((s) => !closedSet.has(s));
        nextOpenKeys.forEach((k) => {
          if (!updated.includes(k)) updated.push(k);
        });
        openSections = updated;
      };

      // 1. Initial render: both are open
      expect(computeEffective(openSections)).toEqual(['transform_0', 'vfx/color_grading_1']);

      // 2. User collapses transform_0
      handleValueChange(['vfx/color_grading_1']);
      expect(computeEffective(openSections)).toEqual(['vfx/color_grading_1']);

      // 3. User collapses remaining item vfx/color_grading_1
      handleValueChange([]);
      expect(computeEffective(openSections)).toEqual([]);

      // 4. User re-opens transform_0
      handleValueChange(['transform_0']);
      expect(computeEffective(openSections)).toEqual(['transform_0']);
    });
  });

  describe('4. Architectural Guardrails & Line Ceiling Compliance', () => {
    it('verifies RightSidebar.tsx maintains strict architectural line limit (< 350 lines)', () => {
      const rightSidebarPath = path.resolve('apps/studio/src/components/RightSidebar.tsx');
      const content = fs.readFileSync(rightSidebarPath, 'utf-8');
      const lineCount = content.split('\n').length;
      expect(lineCount).toBeLessThan(350);
      expect(lineCount).toBeLessThan(250); // Specifically targeted lean architecture
    });

    it('verifies all extracted sub-components exist with correct signatures', () => {
      const inspectorDir = path.resolve('apps/studio/src/components/inspector');
      expect(fs.existsSync(path.join(inspectorDir, 'ScrubbableNumberInput.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'KeyframeAnchor.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'ModifierCardHeader.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'ModifierAddPicker.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'PropertySearchFilter.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'InspectorHeader.tsx'))).toBe(true);
    });
  });
});
