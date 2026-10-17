import { ModifierPluginRegistry, type ModifierPlugin } from './ModifierPluginRegistry';
import { VolumeModifierPlugin } from './audio/VolumeModifierPlugin';
import { PanModifierPlugin } from './audio/PanModifierPlugin';
import { FilterModifierPlugin } from './audio/FilterModifierPlugin';
import { PitchModifierPlugin } from './audio/PitchModifierPlugin';
import { DynamicDuckingPlugin } from './sfx/DynamicDuckingPlugin';

/**
 * Creates an isomorphic stub/browser-safe plugin definition for visual, overlay,
 * editorial, text, and transform modifiers so the client runtime has access
 * to standard plugin types, default targets, and scopes without importing Node/FFI native binaries.
 */
function createClientPluginStub(
  type: string,
  targetScope: 'track' | 'sequence' | 'both' | 'audio' | 'master',
  defaultTarget?: any
): ModifierPlugin<any> {
  return {
    type,
    targetScope,
    defaultTarget,
    execute: () => {
      // Browser-side visual/editorial rendering is handled by the canvas preview engine
    },
  };
}

/**
 * Registers all core standard modifier plugins in a client/browser-safe environment.
 * Pure audio DSP plugins run directly in the browser via WebAudio/Float32.
 * Visual and overlay plugins are registered as client-safe strategy stubs.
 */
export function registerClientModifierPlugins(
  registry: ModifierPluginRegistry = ModifierPluginRegistry.getInstance()
): ModifierPluginRegistry {
  // 1. Pure client Float32 audio DSP plugins
  registry.register(new VolumeModifierPlugin());
  registry.register(new PanModifierPlugin());
  registry.register(new FilterModifierPlugin());
  registry.register(new PitchModifierPlugin());
  registry.register(new DynamicDuckingPlugin());

  // 2. Client-safe standard visual, overlay, editorial & transform plugin definitions
  registry.register(createClientPluginStub('transform', 'sequence', ['video', 'timed-text', 'image', 'overlay']));
  registry.register(createClientPluginStub('overlay/canvas_particles', 'both', ['video', 'overlay']));
  registry.register(createClientPluginStub('overlay/hologram_hud', 'both', ['video', 'overlay']));
  registry.register(createClientPluginStub('vfx/depth_relighting', 'sequence', ['video', 'image']));
  registry.register(createClientPluginStub('vfx/depth3d', 'sequence', ['video', 'image']));
  registry.register(createClientPluginStub('camera/3d', 'both', ['video', 'image', 'overlay']));
  registry.register(createClientPluginStub('vfx/color_grading', 'both', ['video', 'image', 'overlay']));
  registry.register(createClientPluginStub('text/style', 'sequence', 'timed-text'));
  registry.register(createClientPluginStub('sfx/procedural', 'sequence', 'audio'));
  registry.register(createClientPluginStub('editorial/split_edit', 'sequence', ['video', 'audio']));
  registry.register(createClientPluginStub('editorial/transition_crossfade', 'sequence', ['video', 'audio', 'image']));
  registry.register(createClientPluginStub('overlay/blend_mode', 'both', ['video', 'overlay', 'image']));

  return registry;
}
