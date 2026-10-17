import { ModifierPluginRegistry } from './ModifierPluginRegistry';
import { Depth3DPlugin } from './vfx/Depth3DPlugin';
import { Camera3DPlugin } from './vfx/Camera3DPlugin';
import { DynamicDuckingPlugin } from './sfx/DynamicDuckingPlugin';
import { SplitEditPlugin } from './editorial/SplitEditPlugin';
import { TransitionCrossfadePlugin } from './editorial/TransitionCrossfadePlugin';
import { BlendModePlugin } from './overlay/BlendModePlugin';
import { CanvasParticleOverlayPlugin } from './overlay/CanvasParticleOverlayPlugin';
import { ColorGradingPlugin } from './vfx/ColorGradingPlugin';
import { VolumeModifierPlugin } from './audio/VolumeModifierPlugin';
import { PanModifierPlugin } from './audio/PanModifierPlugin';
import { FilterModifierPlugin } from './audio/FilterModifierPlugin';
import { PitchModifierPlugin } from './audio/PitchModifierPlugin';

export * from './ModifierPluginRegistry';
export * from './IVideoPluginStrategy';
export * from './vfx/Depth3DPlugin';
export * from './vfx/Camera3DPlugin';
export * from './vfx/ColorGradingPlugin';
export * from './sfx/DynamicDuckingPlugin';
export * from './editorial/SplitEditPlugin';
export * from './editorial/TransitionCrossfadePlugin';
export * from './overlay/BlendModePlugin';
export * from './overlay/CanvasParticleOverlayPlugin';
export * from './audio/VolumeModifierPlugin';
export * from './audio/PanModifierPlugin';
export * from './audio/FilterModifierPlugin';
export * from './audio/PitchModifierPlugin';

/**
 * Initializes and registers standard core modifier plugins
 */
export function registerCoreModifierPlugins(): ModifierPluginRegistry {
  const registry = ModifierPluginRegistry.getInstance();
  registry.register(new Depth3DPlugin());
  registry.register(new Camera3DPlugin());
  registry.register(new ColorGradingPlugin());
  registry.register(new DynamicDuckingPlugin());
  registry.register(new SplitEditPlugin());
  registry.register(new TransitionCrossfadePlugin());
  registry.register(new BlendModePlugin());
  registry.register(new CanvasParticleOverlayPlugin());
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
  registry.register(new Depth3DPlugin());
  registry.register(new Camera3DPlugin());
  registry.register(new ColorGradingPlugin());
  registry.register(new DynamicDuckingPlugin());
  registry.register(new SplitEditPlugin());
  registry.register(new TransitionCrossfadePlugin());
  registry.register(new BlendModePlugin());
  registry.register(new CanvasParticleOverlayPlugin());
  registry.register(new VolumeModifierPlugin());
  registry.register(new PanModifierPlugin());
  registry.register(new FilterModifierPlugin());
  registry.register(new PitchModifierPlugin());
  return registry;
}
