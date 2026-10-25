import { describe, it, expect } from 'bun:test';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
} from '../packages/ir/src/index';
import {
  getAvailableModifiersFromRegistry,
  MODIFIER_PRESENTATION_CATALOG,
} from '../apps/studio/src/components/inspector/modifierCatalog';
import {
  resolveModifierSchemaOrInfer,
  inferFieldDescriptor,
} from '../apps/studio/src/components/inspector/DynamicModifierInspector';
import { resolveParamControlStrategy } from '../apps/studio/src/components/inspector/ModifierControlStrategies';

describe('Iteration 28: Canonical IR Plugins & Categorized Add Effect Suite', () => {
  describe('1. Canonical IR Plugin Registry (Zero Legacy Aliases)', () => {
    it('has motion/gsap registered and zero legacy animation/gsap alias', () => {
      const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
      expect(registry.has('motion/gsap')).toBe(true);
      expect(registry.has('animation/gsap')).toBe(false);
    });

    it('has overlay/hologram_hud registered and zero overlay/sci_fi_hud alias', () => {
      const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
      expect(registry.has('overlay/hologram_hud')).toBe(true);
      expect(registry.has('overlay/sci_fi_hud')).toBe(false);
    });

    it('has vfx/camera_3d registered without duplicate camera/3d in core registry', () => {
      const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
      expect(registry.has('vfx/camera_3d')).toBe(true);
      expect(registry.has('camera/3d')).toBe(false);
    });

    it('has canonical transition/crossfade without duplicate editorial aliases in core registry', () => {
      const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
      expect(registry.has('transition/crossfade')).toBe(true);
      expect(registry.has('editorial/transition_crossfade')).toBe(false);
      expect(registry.has('editorial/transition')).toBe(false);
      expect(registry.has('transition')).toBe(false);
    });
  });

  describe('2. Dynamic & Categorized Add Effect Registry Discovery', () => {
    it('dynamically groups all registered modifiers into structured categories', () => {
      const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
      const available = getAvailableModifiersFromRegistry(registry);

      // Verify no duplicates
      const seenTypes = new Set<string>();
      for (const item of available) {
        expect(seenTypes.has(item.type)).toBe(false);
        seenTypes.add(item.type);
        expect(item.category).toBeDefined();
        expect(['motion', 'vfx', 'transitions', 'audio', 'text', 'custom']).toContain(item.category);
      }

      // Check motion group
      const motionMods = available.filter((m) => m.category === 'motion');
      expect(motionMods.some((m) => m.type === 'transform')).toBe(true);
      expect(motionMods.some((m) => m.type === 'motion/gsap')).toBe(true);
      // Ensure no redundant animation/gsap item
      expect(motionMods.some((m) => m.type === 'animation/gsap')).toBe(false);

      // Check vfx group
      const vfxMods = available.filter((m) => m.category === 'vfx');
      expect(vfxMods.some((m) => m.type === 'vfx/camera_3d')).toBe(true);
      expect(vfxMods.some((m) => m.type === 'overlay/hologram_hud')).toBe(true);
    });

    it('dynamically adapts when a third-party custom plugin is registered at runtime', () => {
      const registry = ModifierPluginRegistry.createIsolated();
      registerCoreModifierPlugins(registry);

      registry.register({
        type: 'custom/neon_glitch',
        targetScope: 'sequence',
        targetPhase: 2,
        schema: { fields: {} },
        validate: (p: any): p is any => true,
        execute: () => {},
      });

      const available = getAvailableModifiersFromRegistry(registry);
      const customItem = available.find((m) => m.type === 'custom/neon_glitch');
      expect(customItem).toBeDefined();
      expect(customItem?.name).toBe('Neon Glitch');
      expect(customItem?.category).toBe('custom');
    });
  });

  describe('3. Transform Animation & motion_lifecycle Schema', () => {
    it('TransformModifierPlugin schema exposes animation field as motion_lifecycle', () => {
      const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
      const transformSchema = registry.getSchema('transform');
      expect(transformSchema).toBeDefined();
      expect(transformSchema?.fields.animation).toBeDefined();
      expect(transformSchema?.fields.animation.type).toBe('motion_lifecycle');

      const strategy = resolveParamControlStrategy(transformSchema!.fields.animation);
      expect(strategy).toBeDefined();
    });

    it('inferFieldDescriptor maps animation object to motion_lifecycle and never renders [object Object]', () => {
      const animVal = {
        preset: 'pop_in',
        intro: { durationSec: 0.5, ease: 'power2.out' },
        outro: { durationSec: 0.3, ease: 'power2.in' },
      };

      const desc = inferFieldDescriptor('animation', animVal);
      expect(desc.type).toBe('motion_lifecycle');
      expect(desc.defaultValue).toEqual(animVal);

      const strategy = resolveParamControlStrategy(desc);
      expect(strategy).toBeDefined();
    });

    it('resolveModifierSchemaOrInfer cleanly merges registered fields and ignores extra runtime keys', () => {
      const res = resolveModifierSchemaOrInfer('transform', {
        x: 10,
        y: 20,
        animation: { preset: 'pop_in' },
      });

      expect(res.isInferred).toBe(false);
      const animField = res.fields.find((f) => f.key === 'animation');
      expect(animField).toBeDefined();
      expect(animField?.type).toBe('motion_lifecycle');
    });
  });
});
