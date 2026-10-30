import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import type { ModifierPlugin, ModifierContext, StreamRenderContext, ClipRenderContext } from '../ModifierPluginRegistry';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';
import {
  DeterministicParticleField,
  PostProcessingShaders,
} from '@acc/effect-engines';

export type ProceduralParticleType =
  | 'rain'
  | 'snow'
  | 'dust'
  | 'embers'
  | 'fire'
  | 'smoke'
  | 'fog'
  | 'light_leak'
  | 'vhs'
  | 'digital_glitch'
  | 'bokeh'
  | 'sci_fi_hud'
  | 'matrix_rain'
  | 'speed_lines';

export interface PostProcessingShaderParams {
  chromaticAberration?: { enabled?: boolean; offsetPx?: number };
  bloom?: { enabled?: boolean; threshold?: number; intensity?: number };
  anamorphicFlare?: { enabled?: boolean; intensity?: number; tintColor?: string };
}

export interface CanvasParticleOverlayParams {
  type: ProceduralParticleType | string;
  variant?: string;
  intensity?: number;
  speed?: number;
  opacity?: number;
  useSIMD?: boolean;
  shaders?: PostProcessingShaderParams;
}

export const PARTICLE_PRESET_DEFAULTS: Record<
  string,
  {
    intensity: number;
    speed: number;
    opacity: number;
    particleCount: number;
    bloomEnabled: boolean;
    bloomThreshold: number;
    bloomIntensity: number;
    chromaticAberrationEnabled: boolean;
    chromaticAberrationOffset: number;
  }
> = {
  cyber_sparks: {
    intensity: 1.2,
    speed: 1.8,
    opacity: 0.9,
    particleCount: 1500,
    bloomEnabled: true,
    bloomThreshold: 0.6,
    bloomIntensity: 1.5,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 2.5,
  },
  embers: {
    intensity: 1.0,
    speed: 0.8,
    opacity: 0.85,
    particleCount: 800,
    bloomEnabled: true,
    bloomThreshold: 0.7,
    bloomIntensity: 1.2,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 1.0,
  },
  dust: {
    intensity: 0.6,
    speed: 0.4,
    opacity: 0.5,
    particleCount: 400,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.5,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 0.0,
  },
  rain: {
    intensity: 1.5,
    speed: 2.2,
    opacity: 0.7,
    particleCount: 1200,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.5,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 1.2,
  },
  snow: {
    intensity: 0.8,
    speed: 0.5,
    opacity: 0.75,
    particleCount: 600,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.5,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 0.0,
  },
  bokeh: {
    intensity: 0.9,
    speed: 0.3,
    opacity: 0.6,
    particleCount: 300,
    bloomEnabled: true,
    bloomThreshold: 0.5,
    bloomIntensity: 1.8,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 0.5,
  },
  matrix_rain: {
    intensity: 1.3,
    speed: 1.6,
    opacity: 0.85,
    particleCount: 1800,
    bloomEnabled: true,
    bloomThreshold: 0.65,
    bloomIntensity: 1.4,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 2.0,
  },
  digital_glitch: {
    intensity: 1.4,
    speed: 2.0,
    opacity: 0.9,
    particleCount: 1000,
    bloomEnabled: true,
    bloomThreshold: 0.5,
    bloomIntensity: 2.0,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 4.0,
  },
};

/**
 * CanvasParticleOverlayPlugin:
 * Implements Section 3.3 of Document 7 (`overlay/canvas_particles`).
 * Powered by DeterministicParticleField (Pts.js Noise + GSAP Easing) and PostProcessingShaders.
 * 100% Stateless: scrubbing or jumping to any frame produces the bit-identical particle distribution.
 */
export class CanvasParticleOverlayPlugin implements ModifierPlugin<CanvasParticleOverlayParams> {
  public readonly type = 'overlay/canvas_particles';
  public readonly targetScope: ModifierTargetScope = 'standalone';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['overlay', 'video', 'image'];
  public readonly targetPhase = 3;
  public readonly schema = {
    displayName: 'Particle VFX & Shaders',
    category: 'overlay' as const,
    fields: {
      type: {
        key: 'type',
        label: 'Particle System Type',
        type: 'select' as const,
        defaultValue: 'cyber_sparks',
        options: [
          { label: 'Cyber Sparks (High-velocity electric arcs)', value: 'cyber_sparks' },
          { label: 'Floating Embers (Warm upward drifting sparks)', value: 'embers' },
          { label: 'Atmospheric Dust (Slow ambient specks)', value: 'dust' },
          { label: 'Cinematic Rain (Downward streaks with splash)', value: 'rain' },
          { label: 'Gentle Snow (Soft swirling flakes)', value: 'snow' },
          { label: 'Dreamy Bokeh (Floating soft focus circles)', value: 'bokeh' },
          { label: 'Matrix Rain (Digital falling code streams)', value: 'matrix_rain' },
          { label: 'Digital Glitch (Corrupted pixel fragments)', value: 'digital_glitch' },
          { label: 'Sci-Fi HUD (Telemetry Reticle Overlay)', value: 'sci_fi_hud' },
        ],
      },
      intensity: {
        key: 'intensity',
        label: 'Emission Intensity',
        type: 'number' as const,
        min: 0.1,
        max: 3.0,
        step: 0.05,
        defaultValue: 1.0,
      },
      speed: {
        key: 'speed',
        label: 'Velocity Multiplier',
        type: 'number' as const,
        min: 0.1,
        max: 3.0,
        step: 0.1,
        defaultValue: 1.0,
      },
      opacity: {
        key: 'opacity',
        label: 'Layer Opacity',
        type: 'number' as const,
        min: 0.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.8,
      },
      particleCount: {
        key: 'particleCount',
        label: 'Particle Count',
        type: 'number' as const,
        min: 50,
        max: 3000,
        step: 50,
        defaultValue: 1500,
      },
      shaders: {
        key: 'shaders',
        label: 'Shader Post-Processing',
        type: 'shader_group' as const,
        defaultValue: {
          bloom: { enabled: true, threshold: 0.7, intensity: 1.0 },
          chromaticAberration: { enabled: true, offsetPx: 2.0 },
        },
      },
    },
  };

  public validate(params: unknown): params is CanvasParticleOverlayParams {
    return Boolean(params && typeof params === 'object' && 'type' in params);
  }

  public async execute(context: ModifierContext, params: CanvasParticleOverlayParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.particleOverlay = {
      type: params.type,
      variant: params.variant || 'default',
      intensity: params.intensity ?? 1.0,
      active: true,
    };
  }

  public renderClipSpace(ctx: ClipRenderContext, params: CanvasParticleOverlayParams): void {
    this.renderStreamSpace(ctx as any, params);
  }

  public renderStreamSpace(ctx: StreamRenderContext, params: CanvasParticleOverlayParams): void {
    const { ctx: canvasCtx, width, height, frame } = ctx;

    // 1. Render 100% deterministic, stateless particle field
    DeterministicParticleField.render(canvasCtx, width, height, frame, params);

    // 2. Post-Processing Shaders Pass
    if (params.shaders) {
      // A. Bloom & Glow
      if (params.shaders.bloom?.enabled) {
        try {
          const uScratch = UniversalCanvasProvider.acquireScratchCanvas(width, height);
          const scratch = uScratch.getRawCanvas ? uScratch.getRawCanvas() : uScratch;
          const sCtx = scratch.getContext('2d');
          PostProcessingShaders.applyBloom(
            canvasCtx,
            scratch,
            sCtx,
            width,
            height,
            params.shaders.bloom.threshold ?? 0.7,
            params.shaders.bloom.intensity ?? 0.5
          );
          UniversalCanvasProvider.releaseScratchCanvas(uScratch);
        } catch {}
      }

      // B. Anamorphic Lens Flare
      if (params.shaders.anamorphicFlare?.enabled) {
        PostProcessingShaders.applyAnamorphicFlare(
          canvasCtx,
          width,
          height,
          80,
          params.shaders.anamorphicFlare.intensity ?? 0.4,
          params.shaders.anamorphicFlare.tintColor ?? 'rgba(70, 160, 255, 0.4)'
        );
      }

      // C. Chromatic Aberration
      if (params.shaders.chromaticAberration?.enabled) {
        const imgData = canvasCtx.getImageData(0, 0, width, height);
        PostProcessingShaders.applyChromaticAberration(
          imgData.data,
          width,
          height,
          params.shaders.chromaticAberration.offsetPx ?? 3
        );
        canvasCtx.putImageData(imgData, 0, 0);
      }
    }
  }
}
