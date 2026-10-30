import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  createIsolatedCoreModifierPlugins,
  STANDALONE_SEQUENCE_ALLOWED_MODIFIERS,
  type ModifierPlugin,
  type ModifierTargetScope,
} from '@acc/ir';

describe('Iteration 59: Modifier Plugin Contract Audit & Self-Enforcing Taxonomy Matrix', () => {
  let registry: ModifierPluginRegistry;

  beforeEach(() => {
    registry = createIsolatedCoreModifierPlugins();
  });

  // Test Vector 1: Single Source of Truth Contract Integrity
  it('should verify that all registered plugins declare valid targetScope, supportedTrackTypes, and schema', () => {
    const plugins = registry.listPlugins();
    expect(plugins.length).toBeGreaterThanOrEqual(25);

    const validScopes: Set<ModifierTargetScope> = new Set(['standalone', 'sequence', 'track', 'timeline']);

    for (const plugin of plugins) {
      // 1. Target scope
      expect(validScopes.has(plugin.targetScope)).toBe(true);
      expect((plugin.targetScope as any) === 'both').toBe(false);

      // 2. Type discriminator
      expect(typeof plugin.type).toBe('string');
      expect(plugin.type.length).toBeGreaterThan(0);

      // 3. Supported track types
      if (plugin.supportedTrackTypes) {
        expect(Array.isArray(plugin.supportedTrackTypes)).toBe(true);
        expect(plugin.supportedTrackTypes.length).toBeGreaterThan(0);
        for (const t of plugin.supportedTrackTypes) {
          expect(['video', 'audio', 'timed_text', 'data']).toContain(t);
        }
      }

      // 4. Parameter Schema & UI descriptor
      if (plugin.schema) {
        expect(typeof plugin.schema).toBe('object');
        if (plugin.schema.displayName) {
          expect(typeof plugin.schema.displayName).toBe('string');
        }
        if (plugin.schema.category) {
          expect(typeof plugin.schema.category).toBe('string');
        }
      }
    }
  });

  // Test Vector 2: Universal Modifier Whitelist Integrity
  it('should verify that universal modifiers strictly adhere to universal canvas requirements', () => {
    const plugins = registry.listPlugins();
    const universalPlugins = plugins.filter(
      (p) => p.isUniversal === true || STANDALONE_SEQUENCE_ALLOWED_MODIFIERS.has(p.type)
    );

    expect(universalPlugins.length).toBeGreaterThan(0);

    for (const plugin of universalPlugins) {
      // Universal modifiers MUST operate at sequence level
      expect(plugin.targetScope).toBe('sequence');

      // Universal visual modifiers must permit overlay sequences
      if (plugin.allowedSequenceTypes && !plugin.type.startsWith('audio/')) {
        expect(plugin.allowedSequenceTypes).toContain('overlay');
      }

      // Universal modifiers must be members of the standalone whitelist
      expect(STANDALONE_SEQUENCE_ALLOWED_MODIFIERS.has(plugin.type)).toBe(true);
    }
  });

  // Test Vector 3: Standalone Generator Constraints
  it('should verify that standalone generators strictly disallow universal flags and enforce single-instance policy', () => {
    const plugins = registry.listPlugins();
    const standaloneGenerators = plugins.filter((p) => p.targetScope === 'standalone');

    expect(standaloneGenerators.length).toBeGreaterThanOrEqual(10);

    for (const gen of standaloneGenerators) {
      // Standalone generators must never be marked as universal canvas tools
      expect(gen.isUniversal).not.toBe(true);
      expect(STANDALONE_SEQUENCE_ALLOWED_MODIFIERS.has(gen.type)).toBe(false);

      // Must permit overlay (or audio for audio generators)
      if (gen.allowedSequenceTypes) {
        const permitsOverlayOrAudio =
          gen.allowedSequenceTypes.includes('overlay') || gen.allowedSequenceTypes.includes('audio');
        expect(permitsOverlayOrAudio).toBe(true);
      }
    }
  });

  // Test Vector 4: Dynamic Capability Matrix Derivation
  it('should compile an authoritative capability matrix via getCapabilityMatrix()', () => {
    const matrix = registry.getCapabilityMatrix();
    expect(Array.isArray(matrix)).toBe(true);
    expect(matrix.length).toBe(registry.listPlugins().length);

    for (const entry of matrix) {
      expect(typeof entry.type).toBe('string');
      expect(['standalone', 'sequence', 'track', 'timeline']).toContain(entry.targetScope);
      expect(typeof entry.isUniversal).toBe('boolean');
      expect(Array.isArray(entry.supportedTrackTypes)).toBe(true);
      expect(['single', 'multiple']).toContain(entry.instancePolicy);
    }

    // Transform must be universal
    const transformEntry = matrix.find((e) => e.type === 'transform');
    expect(transformEntry).toBeDefined();
    expect(transformEntry?.isUniversal).toBe(true);
    expect(transformEntry?.targetScope).toBe('sequence');

    // Camera 3D must NOT be universal
    const cameraEntry = matrix.find((e) => e.type === 'vfx/camera_3d');
    expect(cameraEntry).toBeDefined();
    expect(cameraEntry?.isUniversal).toBe(false);

    // Hologram HUD must be standalone and NOT universal
    const hudEntry = matrix.find((e) => e.type === 'overlay/hologram_hud');
    expect(hudEntry).toBeDefined();
    expect(hudEntry?.targetScope).toBe('standalone');
    expect(hudEntry?.isUniversal).toBe(false);

    // Timed text must be track level
    const textEntry = matrix.find((e) => e.type === 'timed_text/style');
    expect(textEntry).toBeDefined();
    expect(textEntry?.targetScope).toBe('track');

    // Photometric bloom must be timeline level
    const bloomEntry = matrix.find((e) => e.type === 'timeline/photometric_bloom');
    expect(bloomEntry).toBeDefined();
    expect(bloomEntry?.targetScope).toBe('timeline');
  });
});
