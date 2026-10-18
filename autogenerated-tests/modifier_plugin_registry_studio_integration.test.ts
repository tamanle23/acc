import { describe, it, expect } from 'bun:test';
import {
  ModifierPluginRegistry,
  type ModifierPlugin,
} from '../packages/ir/src/client';
import { registerCoreModifierPlugins } from '../packages/ir/src';
import {
  getAvailableModifiersFromRegistry,
  MODIFIER_PRESENTATION_CATALOG,
} from '../apps/studio/src/components/RightSidebar';

describe('ModifierPluginRegistry & RightSidebar Dynamic Integration', () => {
  it('should list all registered plugins via listPlugins()', () => {
    const isolated = ModifierPluginRegistry.createIsolated();
    expect(isolated.listPlugins().length).toBe(0);

    const testPlugin: ModifierPlugin<any> = {
      type: 'vfx/mock_custom',
      targetScope: 'sequence',
      defaultTarget: 'video',
      execute: () => {},
    };

    isolated.register(testPlugin);
    expect(isolated.listPlugins().length).toBe(1);
    expect(isolated.listPlugins()[0].type).toBe('vfx/mock_custom');
    expect(isolated.listTypes()).toContain('vfx/mock_custom');
  });

  it('should populate isolated registry with client-safe core plugins', () => {
    const isolated = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(isolated);

    const types = isolated.listTypes();
    expect(types).toContain('transform');
    expect(types).toContain('overlay/canvas_particles');
    expect(types).toContain('overlay/hologram_hud');
    expect(types).toContain('vfx/depth_relighting');
    expect(types).toContain('vfx/depth3d');
    expect(types).toContain('camera/3d');
    expect(types).toContain('vfx/color_grading');
    expect(types).toContain('text/style');
    expect(types).toContain('audio/volume');
    expect(types).toContain('audio/pan');
    expect(types).toContain('audio/filter');
    expect(types).toContain('audio/pitch');
    expect(types).toContain('sfx/dynamic_ducking');
    expect(types).toContain('sfx/procedural');
    expect(types).toContain('editorial/split_edit');
    expect(types).toContain('editorial/transition_crossfade');
    expect(types).toContain('overlay/blend_mode');
  });

  it('should dynamically produce available modifier definitions from registry with catalog enrichment', () => {
    const isolated = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(isolated);

    const available = getAvailableModifiersFromRegistry(isolated);
    expect(available.length).toBeGreaterThanOrEqual(15);

    const particles = available.find((m) => m.type === 'overlay/canvas_particles');
    expect(particles).toBeDefined();
    expect(particles?.name).toBe('Particle VFX & Shaders');
    expect(particles?.supportedTrackTypes).toContain('video');
    expect(particles?.defaultParams.preset).toBe('cyber_sparks');

    const volume = available.find((m) => m.type === 'audio/volume');
    expect(volume).toBeDefined();
    expect(volume?.name).toBe('Volume & Gain DSP');
    expect(volume?.supportedTrackTypes).toContain('audio');
  });

  it('should gracefully handle unknown/custom plugins registered at runtime with dynamic fallback', () => {
    const isolated = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(isolated);

    isolated.register({
      type: 'custom/neon_bloom_vfx',
      targetScope: 'sequence',
      defaultTarget: 'video',
      execute: () => {},
    });

    const available = getAvailableModifiersFromRegistry(isolated);
    const customMod = available.find((m) => m.type === 'custom/neon_bloom_vfx');
    expect(customMod).toBeDefined();
    expect(customMod?.name).toBe('Neon Bloom Vfx');
    expect(customMod?.supportedTrackTypes).toContain('video');
    expect(customMod?.defaultParams.enabled).toBe(true);
    expect(customMod?.icon).toBeDefined();
  });

  it('should filter modifiers accurately by track type for RightSidebar dropdown', () => {
    const isolated = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(isolated);

    const all = getAvailableModifiersFromRegistry(isolated);

    const videoOnly = all.filter((m) => m.supportedTrackTypes.includes('video'));
    expect(videoOnly.some((m) => m.type === 'transform')).toBe(true);
    expect(videoOnly.some((m) => m.type === 'overlay/canvas_particles')).toBe(true);
    expect(videoOnly.some((m) => m.type === 'vfx/depth_relighting')).toBe(true);
    expect(videoOnly.some((m) => m.type === 'audio/volume')).toBe(false);

    const audioOnly = all.filter((m) => m.supportedTrackTypes.includes('audio'));
    expect(audioOnly.some((m) => m.type === 'audio/volume')).toBe(true);
    expect(audioOnly.some((m) => m.type === 'audio/pan')).toBe(true);
    expect(audioOnly.some((m) => m.type === 'sfx/procedural')).toBe(true);
    expect(audioOnly.some((m) => m.type === 'camera/3d')).toBe(false);

    const textOnly = all.filter((m) => m.supportedTrackTypes.includes('timed_text'));
    expect(textOnly.some((m) => m.type === 'text/style')).toBe(true);
    expect(textOnly.some((m) => m.type === 'transform')).toBe(true);
    expect(textOnly.some((m) => m.type === 'audio/volume')).toBe(false);
  });
});
