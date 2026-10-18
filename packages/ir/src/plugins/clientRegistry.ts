import { ModifierPluginRegistry, type ModifierPlugin } from './ModifierPluginRegistry';
import { VolumeModifierPlugin } from './audio/VolumeModifierPlugin';
import { PanModifierPlugin } from './audio/PanModifierPlugin';
import { FilterModifierPlugin } from './audio/FilterModifierPlugin';
import { PitchModifierPlugin } from './audio/PitchModifierPlugin';
import { DynamicDuckingPlugin } from './sfx/DynamicDuckingPlugin';
import { HologramHUDPlugin } from './overlay/HologramHUDPlugin';
import { PartialVFXPlugin } from './vfx/PartialVFXPlugin';
import { TransformModifierPlugin } from './transform/TransformModifierPlugin';
import { CaptionModifierPlugin } from './text/CaptionModifierPlugin';

import { ShapeModifierPlugin } from './shape/ShapeModifierPlugin';
import { ProceduralSFXModifierPlugin } from './sfx/ProceduralSFXModifierPlugin';

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
 * Transform, caption, hologram HUD, partial VFX, shape, and procedural SFX plugins run their real implementations.
 * Node-dependent plugins (Depth3D, Camera3D) are registered as client-safe strategy stubs until migrated.
 */
export function registerClientModifierPlugins(
  registry: ModifierPluginRegistry = ModifierPluginRegistry.getInstance()
): ModifierPluginRegistry {
  // 1. Pure client Float32 audio DSP plugins
  registry.register(new VolumeModifierPlugin());
  registry.register(new PanModifierPlugin());
  registry.register(new FilterModifierPlugin());
  const pitchPlugin = new PitchModifierPlugin();
  registry.register(pitchPlugin);
  registry.register(new ProceduralSFXModifierPlugin());
  registry.register(new DynamicDuckingPlugin());

  // 2. Real isomorphic visual, transform, shape, and overlay plugins
  registry.register(new TransformModifierPlugin());
  registry.register(new CaptionModifierPlugin());
  registry.register(new ShapeModifierPlugin('shape/draw'));
  registry.register(new ShapeModifierPlugin('shape/vector'));
  const hudPlugin = new HologramHUDPlugin();
  registry.register(hudPlugin);
  registry.register({
    ...hudPlugin,
    type: 'overlay/sci_fi_hud',
  });
  registry.register(new PartialVFXPlugin());

  // 3. Client-safe visual stubs for Node/FFI-dependent plugins (Depth3D, Camera3D, etc.)
  registry.register(createClientPluginStub('overlay/canvas_particles', 'both', ['video', 'overlay']));
  registry.register(createClientPluginStub('vfx/depth_relighting', 'sequence', ['video', 'image']));
  registry.register(createClientPluginStub('vfx/depth3d', 'sequence', ['video', 'image']));
  registry.register(createClientPluginStub('camera/3d', 'both', ['video', 'image', 'overlay']));
  registry.register(createClientPluginStub('vfx/camera_3d', 'both', ['video', 'image', 'overlay']));
  registry.register(createClientPluginStub('vfx/color_grading', 'both', ['video', 'image', 'overlay']));
  registry.register(createClientPluginStub('editorial/split_edit', 'sequence', ['video', 'audio']));
  registry.register(createClientPluginStub('editorial/transition_crossfade', 'sequence', ['video', 'audio', 'image']));
  registry.register(createClientPluginStub('transition/crossfade', 'sequence', ['video', 'audio', 'image']));
  registry.register(createClientPluginStub('overlay/blend_mode', 'both', ['video', 'overlay', 'image']));

  return registry;
}
