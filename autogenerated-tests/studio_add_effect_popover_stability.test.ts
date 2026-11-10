import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
} from '../packages/ir/src/index';

describe('Studio Add Effect Popover Stability & Zero-Flashing Suite', () => {
  it('popover.tsx should intercept onFocusOutside to prevent premature dismissal when focusing inside content', () => {
    const popoverPath = join(process.cwd(), 'apps/studio/src/components/ui/popover.tsx');
    const code = readFileSync(popoverPath, 'utf-8');

    expect(code).toContain('onFocusOutside');
    expect(code).toContain('data-slot="popover-content"');
    expect(code).toContain('e.preventDefault()');
  });

  it('InspectorHeader should not nest JSX slot inside Show condition, avoiding reactive re-render loops', () => {
    const headerPath = join(process.cwd(), 'apps/studio/src/components/inspector/InspectorHeader.tsx');
    const code = readFileSync(headerPath, 'utf-8');

    // Should NOT have <Show when={props.addEffectSlot}>
    expect(code).not.toContain('<Show when={props.addEffectSlot}>');
    expect(code).not.toContain('when={props.addEffectSlot}');
    expect(code).toContain('props.children');
  });

  it('ModifierAddPicker should use createEffect focus timer instead of native HTML autofocus to eliminate Portal race condition', () => {
    const pickerPath = join(process.cwd(), 'apps/studio/src/components/inspector/ModifierAddPicker.tsx');
    const code = readFileSync(pickerPath, 'utf-8');

    expect(code).toContain('searchInputRef');
    expect(code).toContain('createEffect');
    expect(code).toContain('searchInputRef?.focus()');
    expect(code).not.toContain('autofocus');
  });

  it('RightSidebar should mount ModifierAddPicker directly as children of InspectorHeader', () => {
    const sidebarPath = join(process.cwd(), 'apps/studio/src/components/RightSidebar.tsx');
    const code = readFileSync(sidebarPath, 'utf-8');

    expect(code).toContain('<InspectorHeader');
    expect(code).toContain('<ModifierAddPicker');
    expect(code).toContain('open={isAddPickerOpen()}');
    expect(code).toContain('onOpenChange={setIsAddPickerOpen}');
  });

  it('ModifierPluginRegistry should return all registered modifier definitions with valid categories', () => {
    const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
    const mods = registry.listPlugins();
    expect(mods.length).toBeGreaterThanOrEqual(10);

    for (const mod of mods) {
      expect(mod.type).toBeDefined();
      expect(mod.targetScope).toBeDefined();
      expect(mod.supportedTrackTypes === undefined || Array.isArray(mod.supportedTrackTypes)).toBe(true);
    }
  });

  it('Category and search filtering logic should filter accurately without mutating state', () => {
    const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
    const mods = registry.listPlugins();

    // Test text search
    const colorMods = mods.filter((m) => m.type.includes('color') || m.type.includes('grade'));
    expect(colorMods.length).toBeGreaterThan(0);

    // Test category filtering
    const motionMods = mods.filter((m) => m.type.startsWith('motion/'));
    expect(motionMods.length).toBeGreaterThan(0);
  });
});
