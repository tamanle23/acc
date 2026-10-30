import type {
  ModifierPlugin,
  ModifierContext,
  ClipRenderContext,
  StreamRenderContext,
} from '../ModifierPluginRegistry';
import type { SequenceType } from '../../types/VideoIR';
import { Depth3DPlugin, type Depth3DPluginParams } from './Depth3DPlugin';

export interface DepthRelightingAdapterParams {
  enabled?: boolean;
  lightColor?: string;
  lightX?: number;
  lightY?: number;
  lightZ?: number;
  diffuse?: number;
  specular?: number;
  shininess?: number;
  rimIntensity?: number;
  normalStrength?: number;
  ambient?: number;
  [key: string]: any;
}

/**
 * DepthRelightingAdapterPlugin:
 * Dedicated alias adapter for 'vfx/depth_relighting' and 'vfx/depth3d_relighting'.
 *
 * CRITICAL ARCHITECTURAL BOUNDARY:
 * Keeps Depth3DPlugin.ts completely pristine and untouched regarding its Edge AI
 * subject cutout caching, depth-map resolution, and surface normal generators.
 * This adapter receives flat UI parameters from Studio sliders, normalizes them
 * into nested params.relighting, and delegates directly to Depth3DPlugin.
 */
export class DepthRelightingAdapterPlugin implements ModifierPlugin<DepthRelightingAdapterParams> {
  public readonly type = 'vfx/depth_relighting';
  public readonly targetScope = 'sequence';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['video', 'image'];
  public readonly targetPhase = 2;
  public readonly schema = {
    displayName: '3D Depth Relighting',
    category: 'vfx' as const,
    fields: {
      lightColor: {
        key: 'lightColor',
        label: 'Point Light Color',
        type: 'color' as const,
        defaultValue: '#00d4ff',
        presets: [
          { name: 'Cyan Neon', hex: '#00d4ff' },
          { name: 'Solar Amber', hex: '#f59e0b' },
          { name: 'Magenta Pulse', hex: '#ec4899' },
          { name: 'Electric Violet', hex: '#8b5cf6' },
          { name: 'Pure White', hex: '#ffffff' },
        ],
      },
      lightX: {
        key: 'lightX',
        label: 'Light Position X',
        type: 'number' as const,
        min: -10.0,
        max: 10.0,
        step: 0.1,
        defaultValue: 2.0,
      },
      lightY: {
        key: 'lightY',
        label: 'Light Position Y',
        type: 'number' as const,
        min: -10.0,
        max: 10.0,
        step: 0.1,
        defaultValue: 2.0,
      },
      lightZ: {
        key: 'lightZ',
        label: 'Light Depth (Z)',
        type: 'number' as const,
        min: 0.5,
        max: 20.0,
        step: 0.5,
        defaultValue: 5.0,
      },
      diffuse: {
        key: 'diffuse',
        label: 'Diffuse Weight',
        type: 'number' as const,
        min: 0.0,
        max: 3.0,
        step: 0.05,
        defaultValue: 1.0,
      },
      shininess: {
        key: 'shininess',
        label: 'Specular Shininess',
        type: 'number' as const,
        min: 4,
        max: 128,
        step: 4,
        defaultValue: 32,
      },
      rimIntensity: {
        key: 'rimIntensity',
        label: 'Soft Rim Intensity',
        type: 'number' as const,
        min: 0.0,
        max: 2.0,
        step: 0.05,
        defaultValue: 0.5,
      },
    },
  };

  private delegatePlugin: Depth3DPlugin;

  constructor(delegate?: Depth3DPlugin) {
    this.delegatePlugin = delegate || new Depth3DPlugin();
  }

  public validate(params: unknown): params is DepthRelightingAdapterParams {
    return Boolean(params && typeof params === 'object');
  }

  /**
   * Adapts flat UI slider parameters to canonical Depth3DPlugin nested params.
   */
  public normalizeParams(params: DepthRelightingAdapterParams): Depth3DPluginParams {
    const lightX = params.lightX ?? 2.0;
    const lightY = params.lightY ?? 2.0;
    const lightZ = params.lightZ ?? 5.0;

    return {
      mode: params.mode || 'frame_breaker',
      ...params,
      autoDepth: true,
      relighting: {
        enabled: params.enabled !== false,
        lightColor: params.lightColor || '#00d4ff',
        lightPosition: [lightX, lightY, lightZ],
        diffuse: params.diffuse ?? 1.0,
        specular: params.specular ?? 0.8,
        shininess: params.shininess ?? 32,
        rimIntensity: params.rimIntensity ?? 0.5,
        ambient: params.ambient ?? 0.1,
        normalStrength: params.normalStrength ?? 2.0,
        ...(params.relighting || {}),
      },
    };
  }

  public execute(context: ModifierContext, params: DepthRelightingAdapterParams): Promise<void> | void {
    const normalized = this.normalizeParams(params);
    return this.delegatePlugin.execute(context, normalized);
  }

  public renderClipSpace(ctx: ClipRenderContext, params: DepthRelightingAdapterParams): void | Promise<void> {
    const normalized = this.normalizeParams(params);
    return this.delegatePlugin.renderClipSpace(ctx, normalized);
  }

  public renderStreamSpace(ctx: StreamRenderContext, params: DepthRelightingAdapterParams): void | Promise<void> {
    const normalized = this.normalizeParams(params);
    return this.delegatePlugin.renderStreamSpace?.(ctx, normalized);
  }
}
