import { ModifierPluginRegistry } from './ModifierPluginRegistry';
import { Depth3DPlugin } from './vfx/Depth3DPlugin';
import { Camera3DPlugin } from './vfx/Camera3DPlugin';
import { DynamicDuckingPlugin } from './sfx/DynamicDuckingPlugin';
import { SplitEditPlugin } from './editorial/SplitEditPlugin';
import { TransitionCrossfadePlugin } from './editorial/TransitionCrossfadePlugin';
import { UniversalTransitionPlugin } from './editorial/UniversalTransitionPlugin';
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
import { TimeSpaceModifierPlugin } from './TimeSpaceModifierPlugin';
import { GSAPMotionPlugin } from './motion/GSAPMotionPlugin';
import { DepthRelightingAdapterPlugin } from './vfx/DepthRelightingAdapterPlugin';

export * from './ModifierPluginRegistry';
export * from './IVideoPluginStrategy';
export * from './TimeSpaceModifierPlugin';
export * from './vfx/Depth3DPlugin';
export * from './vfx/DepthRelightingAdapterPlugin';
export * from './vfx/Camera3DPlugin';
export * from './vfx/ColorGradingPlugin';
export * from './vfx/PartialVFXPlugin';
export * from './transform/TransformModifierPlugin';
export * from './motion/GSAPMotionPlugin';
export * from './text/CaptionModifierPlugin';
export * from './shape/ShapeModifierPlugin';
export * from './sfx/ProceduralSFXModifierPlugin';
export * from './sfx/DynamicDuckingPlugin';
export * from './editorial/SplitEditPlugin';
export * from './editorial/TransitionCrossfadePlugin';
export * from './editorial/UniversalTransitionPlugin';
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
  const depthPlugin = new Depth3DPlugin();
  registry.register(depthPlugin);
  registry.register(new DepthRelightingAdapterPlugin(depthPlugin));
  registry.register(new Camera3DPlugin());
  registry.register(new ColorGradingPlugin());
  registry.register(new PartialVFXPlugin());
  registry.register(new TransformModifierPlugin());
  registry.register(new GSAPMotionPlugin());
  registry.register(new CaptionModifierPlugin());
  registry.register(new ShapeModifierPlugin('shape/draw'));
  registry.register(new ShapeModifierPlugin('shape/vector'));
  registry.register(new ProceduralSFXModifierPlugin());
  registry.register(new DynamicDuckingPlugin());
  registry.register(new SplitEditPlugin());
  registry.register(new TransitionCrossfadePlugin());
  const universalTrans = new UniversalTransitionPlugin();
  registry.register(universalTrans);
  registry.register(new UniversalTransitionPlugin('transition/wipe'));
  registry.register(new UniversalTransitionPlugin('transition/push'));
  registry.register(new UniversalTransitionPlugin('transition/zoom'));
  registry.register(new UniversalTransitionPlugin('transition/dip'));
  registry.register(new UniversalTransitionPlugin('transition/glitch'));
  registry.register(new UniversalTransitionPlugin('transition/light_leak'));
  registry.register(new UniversalTransitionPlugin('transition/radial_wipe'));
  registry.register(new UniversalTransitionPlugin('transition/iris'));
  registry.register(new BlendModePlugin());
  registry.register(new CanvasParticleOverlayPlugin());
  registry.register(new HologramHUDPlugin());
  registry.register(new VolumeModifierPlugin());
  registry.register(new PanModifierPlugin());
  registry.register(new FilterModifierPlugin());
  registry.register(new PitchModifierPlugin());
  registry.register(new TimeSpaceModifierPlugin());
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
