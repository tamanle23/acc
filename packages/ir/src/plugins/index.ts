import { ModifierPluginRegistry } from './ModifierPluginRegistry';
import { Depth3DPlugin } from './vfx/Depth3DPlugin';
import { DynamicDuckingPlugin } from './sfx/DynamicDuckingPlugin';
import { SplitEditPlugin } from './editorial/SplitEditPlugin';
import { TransitionCrossfadePlugin } from './editorial/TransitionCrossfadePlugin';
import { BlendModePlugin } from './overlay/BlendModePlugin';

export * from './ModifierPluginRegistry';
export * from './vfx/Depth3DPlugin';
export * from './sfx/DynamicDuckingPlugin';
export * from './editorial/SplitEditPlugin';
export * from './editorial/TransitionCrossfadePlugin';
export * from './overlay/BlendModePlugin';

/**
 * Initializes and registers standard core modifier plugins
 */
export function registerCoreModifierPlugins(): ModifierPluginRegistry {
  const registry = ModifierPluginRegistry.getInstance();
  registry.register(new Depth3DPlugin());
  registry.register(new DynamicDuckingPlugin());
  registry.register(new SplitEditPlugin());
  registry.register(new TransitionCrossfadePlugin());
  registry.register(new BlendModePlugin());
  return registry;
}
