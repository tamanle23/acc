import type { ModifierPlugin, ModifierContext, StreamRenderContext, ClipRenderContext } from '../ModifierPluginRegistry';
import {
  DeterministicParticleField,
  PostProcessingShaders,
  UniversalCanvasProvider,
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

/**
 * CanvasParticleOverlayPlugin:
 * Implements Section 3.3 of Document 7 (`overlay/canvas_particles`).
 * Powered by DeterministicParticleField (Pts.js Noise + GSAP Easing) and PostProcessingShaders.
 * 100% Stateless: scrubbing or jumping to any frame produces the bit-identical particle distribution.
 */
export class CanvasParticleOverlayPlugin implements ModifierPlugin<CanvasParticleOverlayParams> {
  public readonly type = 'overlay/canvas_particles';
  public readonly targetScope = 'both';
  public readonly targetPhase = 3;

  private scratchCanvasCache = new Map<string, { canvas: any; ctx: any }>();

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

    const width = context.canvas.width;
    const height = context.canvas.height;
    const key = `${(context.targetEntity as any)?.id || 'default'}_${params.type}`;

    // Pre-allocate scratch canvas for post-processing shaders if requested
    if (params.shaders?.bloom?.enabled || params.shaders?.chromaticAberration?.enabled) {
      const uScratch = UniversalCanvasProvider.createCanvas(width, height);
      const scratch = uScratch.getRawCanvas ? uScratch.getRawCanvas() : uScratch;
      const sCtx = scratch.getContext('2d');
      this.scratchCanvasCache.set(key, { canvas: scratch, ctx: sCtx });
    }
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
      const key = `${(ctx as any).track?.id || (ctx as any).sequence?.id || 'default'}_${params.type}`;
      const scratchEntry = this.scratchCanvasCache.get(key);

      // A. Bloom & Glow
      if (params.shaders.bloom?.enabled && scratchEntry) {
        PostProcessingShaders.applyBloom(
          canvasCtx,
          scratchEntry.canvas,
          scratchEntry.ctx,
          width,
          height,
          params.shaders.bloom.threshold ?? 0.7,
          params.shaders.bloom.intensity ?? 0.5
        );
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
