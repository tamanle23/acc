import { describe, test, expect } from 'bun:test';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  type ModifierPlugin,
} from '../packages/ir/src/index';
import { resolveModifierSchemaOrInfer } from '../apps/studio/src/components/inspector/DynamicModifierInspector';
import { resolveParamControlStrategy } from '../apps/studio/src/components/inspector/ModifierControlStrategies';

describe('ModifierPluginRegistry Declarative Schemas & Strategy Pattern Inspector', () => {
  const registry = registerCoreModifierPlugins(ModifierPluginRegistry.getInstance());

  test('every core modifier plugin in ModifierPluginRegistry exposes a valid ModifierParameterSchema', () => {
    const coreTypes = [
      'vfx/partial',
      'vfx/color_grading',
      'vfx/depth3d',
      'vfx/camera_3d',
      'audio/filter',
      'audio/pan',
      'audio/volume',
      'audio/pitch',
      'transition/crossfade',
      'editorial/split_edit',
      'overlay/blend_mode',
      'overlay/hologram_hud',
      'overlay/canvas_particles',
      'sfx/dynamic_ducking',
      'sfx/procedural',
      'transform',
      'timed_text/style',
      'shape/draw',
      'time_space',
    ];

    for (const type of coreTypes) {
      const schema = registry.getSchema(type);
      expect(schema).toBeDefined();
      const fieldList = Object.values(schema!.fields);
      expect(fieldList.length).toBeGreaterThan(0);

      for (const field of fieldList) {
        expect(typeof field.key).toBe('string');
        expect(typeof field.label).toBe('string');
        const strategy = resolveParamControlStrategy(field);
        expect(strategy).toBeDefined();
      }
    }
  });

  test('vfx/partial schema declares a regions_array control strategy', () => {
    const schema = registry.getSchema('vfx/partial');
    expect(schema).toBeDefined();

    const regionsField = schema?.fields['regions'];
    expect(regionsField).toBeDefined();
    expect(regionsField?.type).toBe('regions_array');
  });

  test('resolveModifierSchemaOrInfer combines registered schema with custom runtime keys and infers unknown third-party plugins', () => {
    // 1. Registered plugin with extra custom runtime param
    const resolvedFilter = resolveModifierSchemaOrInfer(
      'audio/filter',
      {
        filterType: 'bandpass',
        cutoffHz: 1800,
        resonance: 2.5,
        customHarmonicDrive: 0.42,
      },
      registry
    );

    expect(resolvedFilter.isInferred).toBe(false);
    expect(resolvedFilter.fields.some((f) => f.key === 'filterType' && f.type === 'select')).toBe(true);
    expect(resolvedFilter.fields.some((f) => f.key === 'cutoffHz' && f.type === 'number')).toBe(true);
    expect(resolvedFilter.fields.some((f) => f.key === 'customHarmonicDrive' && f.type === 'number')).toBe(true);

    // 2. Unregistered third-party plugin -> reflective inference fallback
    const customPlugin: ModifierPlugin = {
      type: 'custom/quantum_warp',
      targetScope: 'sequence',
      execute: () => {},
    };
    registry.register(customPlugin);

    const inferred = resolveModifierSchemaOrInfer(
      'custom/quantum_warp',
      {
        enabled: true,
        warpStrength: 0.75,
        invertPhase: false,
        tintHex: '#ff00aa',
        shaderMode: 'hyperbolic',
      },
      registry
    );

    expect(inferred.isInferred).toBe(true);
    expect(inferred.displayName).toBe('Quantum Warp');
    expect(inferred.fields.find((f) => f.key === 'warpStrength')?.type).toBe('number');
    expect(inferred.fields.find((f) => f.key === 'invertPhase')?.type).toBe('boolean');
    expect(inferred.fields.find((f) => f.key === 'tintHex')?.type).toBe('color');
    expect(inferred.fields.find((f) => f.key === 'shaderMode')?.type).toBe('string');
  });
});
