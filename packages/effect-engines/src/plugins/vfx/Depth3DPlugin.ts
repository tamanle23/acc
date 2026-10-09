import type { ModifierPlugin, ModifierContext } from '../ModifierPluginRegistry';

export interface Depth3DPluginParams {
  mode: string; // 'frame_breaker' | 'volumetric_sandwich' | 'parallax' | 'depth_mesh' | ...
  frameStyle?: string;
  popOutIntensity?: number;
  autoSegment?: boolean;
}

/**
 * Depth3DPlugin:
 * Bridges existing 3D depth renderers (frame-breaker, sandwich, parallax)
 * into a canonical IR visual modifier (`vfx/depth3d`).
 */
export class Depth3DPlugin implements ModifierPlugin<Depth3DPluginParams> {
  public readonly type = 'vfx/depth3d';
  public readonly targetScope = 'sequence';

  public validate(params: unknown): params is Depth3DPluginParams {
    return Boolean(params && typeof params === 'object' && 'mode' in params);
  }

  public async execute(context: ModifierContext, params: Depth3DPluginParams): Promise<void> {
    if (!context.state) context.state = {};
    // Register depth configuration into the rendering context state
    context.state.depth3d = {
      mode: params.mode || 'frame_breaker',
      frameStyle: params.frameStyle,
      popOutIntensity: params.popOutIntensity ?? 1.0,
      active: true,
    };
  }
}
