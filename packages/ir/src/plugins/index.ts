import { ModifierPluginRegistry } from './ModifierPluginRegistry';
import { Depth3DPlugin } from './vfx/Depth3DPlugin';
import { Camera3DPlugin } from './vfx/Camera3DPlugin';
import { DynamicDuckingPlugin } from './sfx/DynamicDuckingPlugin';
import { SplitEditPlugin } from './editorial/SplitEditPlugin';
import { TransitionCrossfadePlugin } from './editorial/TransitionCrossfadePlugin';
import { BlendModePlugin } from './overlay/BlendModePlugin';
import { CanvasParticleOverlayPlugin } from './overlay/CanvasParticleOverlayPlugin';
import { HologramHUDPlugin } from './overlay/HologramHUDPlugin';
import { PartialVFXPlugin } from './vfx/PartialVFXPlugin';
import { ColorGradingPlugin } from './vfx/ColorGradingPlugin';
import { TransformModifierPlugin } from './transform/TransformModifierPlugin';
import { CaptionModifierPlugin } from './text/CaptionModifierPlugin';
import { VolumeModifierPlugin } from './audio/VolumeModifierPlugin';
import { PanModifierPlugin } from './audio/PanModifierPlugin';
import { FilterModifierPlugin } from './audio/FilterModifierPlugin';
import { PitchModifierPlugin } from './audio/PitchModifierPlugin';
import { ShapeModifierPlugin } from './shape/ShapeModifierPlugin';
import { ProceduralSFXModifierPlugin } from './sfx/ProceduralSFXModifierPlugin';

export * from './ModifierPluginRegistry';
export * from './IVideoPluginStrategy';
export * from './vfx/Depth3DPlugin';
export * from './vfx/Camera3DPlugin';
export * from './vfx/ColorGradingPlugin';
export * from './vfx/PartialVFXPlugin';
export * from './transform/TransformModifierPlugin';
export * from './text/CaptionModifierPlugin';
export * from './shape/ShapeModifierPlugin';
export * from './sfx/ProceduralSFXModifierPlugin';
export * from './sfx/DynamicDuckingPlugin';
export * from './editorial/SplitEditPlugin';
export * from './editorial/TransitionCrossfadePlugin';
export * from './overlay/BlendModePlugin';
export * from './overlay/CanvasParticleOverlayPlugin';
export * from './overlay/HologramHUDPlugin';
export * from './audio/VolumeModifierPlugin';
export * from './audio/PanModifierPlugin';
export * from './audio/FilterModifierPlugin';
export * from './audio/PitchModifierPlugin';

/**
 * Initializes and registers standard core modifier plugins
 */
export function registerCoreModifierPlugins(
  targetRegistry?: ModifierPluginRegistry
): ModifierPluginRegistry {
  const registry = targetRegistry ?? ModifierPluginRegistry.getInstance();
  registry.register(new Depth3DPlugin());
  registry.register(new Camera3DPlugin());
  registry.register(new ColorGradingPlugin());
  registry.register(new PartialVFXPlugin());
  registry.register(new TransformModifierPlugin());
  registry.register(new CaptionModifierPlugin());
  registry.register(new ShapeModifierPlugin('shape/draw'));
  registry.register(new ShapeModifierPlugin('shape/vector'));
  registry.register(new ProceduralSFXModifierPlugin());
  registry.register(new DynamicDuckingPlugin());
  registry.register(new SplitEditPlugin());
  const xfadePlugin = new TransitionCrossfadePlugin();
  registry.register(xfadePlugin);
  registry.register({ ...xfadePlugin, type: 'editorial/transition_crossfade' });
  registry.register(new BlendModePlugin());
  registry.register(new CanvasParticleOverlayPlugin());
  const hudPlugin = new HologramHUDPlugin();
  registry.register(hudPlugin);
  // Alias overlay/sci_fi_hud to HologramHUDPlugin for full backward compatibility
  registry.register({
    ...hudPlugin,
    type: 'overlay/sci_fi_hud',
  });
  // Backward compatibility alias for camera/3d -> vfx/camera_3d
  const camPlugin = new Camera3DPlugin();
  registry.register({ ...camPlugin, type: 'camera/3d' });
  // Backward compatibility alias for vfx/depth_relighting -> vfx/depth3d
  const depthPlugin = new Depth3DPlugin();
  registry.register({ ...depthPlugin, type: 'vfx/depth_relighting' });
  registry.register(new VolumeModifierPlugin());
  registry.register(new PanModifierPlugin());
  registry.register(new FilterModifierPlugin());
  registry.register(new PitchModifierPlugin());
  return registry;
}

/**
 * Creates a fresh, isolated ModifierPluginRegistry with new plugin instances
 * (crucial for multi-worker parallel rendering to prevent cache cross-contamination).
 */
export function createIsolatedCoreModifierPlugins(): ModifierPluginRegistry {
  const registry = ModifierPluginRegistry.createIsolated();
  return registerCoreModifierPlugins(registry);
}
