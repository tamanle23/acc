import type { Image, Canvas } from '@napi-rs/canvas';
import type { Depth3DConfig, CaptionConfig } from '../types';
import type { DepthMeshLayers } from './depth-mesh';
import { Depth3DRendererRegistry } from './strategy';
import { registerAll3DEffectStrategies } from './renderers';

export * from './strategy';
export * from './renderers';

// Automatically register all strategies on module import
registerAll3DEffectStrategies();

export class Depth3DFactory {
  public static getRenderer(mode: string) {
    const registry = Depth3DRendererRegistry.getInstance();
    const renderer = registry.get(mode);
    if (!renderer) {
      // Fallback to default frame_breaker if mode not found
      return registry.get('frame_breaker');
    }
    return renderer;
  }

  public static listAvailableModes(): string[] {
    return Depth3DRendererRegistry.getInstance().listModes();
  }
}
