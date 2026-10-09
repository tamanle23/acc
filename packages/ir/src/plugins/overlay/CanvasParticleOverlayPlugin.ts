import type { ModifierPlugin, ModifierContext, StreamRenderContext } from '../ModifierPluginRegistry';

export interface CanvasParticleOverlayParams {
  type: 'rain' | 'snow' | 'dust' | 'embers' | 'light_leak' | 'vhs';
  variant?: string;
  intensity?: number;
  speed?: number;
  opacity?: number;
}

/**
 * CanvasParticleOverlayPlugin:
 * Implements Section 3.3 of Document 7 (`overlay/luma_particle_canvas` & `overlay/alpha_particle_canvas`).
 * Renders procedural particles (Rain, Snow, Dust, Embers, VHS lines) directly onto the canvas.
 * Phase 3: Track-Level Execution (Stream Space).
 */
export class CanvasParticleOverlayPlugin implements ModifierPlugin<CanvasParticleOverlayParams> {
  public readonly type = 'overlay/canvas_particles';
  public readonly targetScope = 'both';
  public readonly targetPhase = 3;

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

  public renderStreamSpace(ctx: StreamRenderContext, params: CanvasParticleOverlayParams): void {
    const { ctx: canvasCtx, width, height, frame } = ctx;
    const intensity = params.intensity ?? 1.0;
    const opacity = params.opacity ?? 0.6;

    canvasCtx.save();
    canvasCtx.globalAlpha = opacity;

    if (params.type === 'snow') {
      const flakeCount = Math.floor(60 * intensity);
      canvasCtx.fillStyle = '#ffffff';
      for (let i = 0; i < flakeCount; i++) {
        // Deterministic pseudo-random placement based on frame and particle index
        const x = (Math.sin(i * 99 + frame * 0.02) * 0.5 + 0.5) * width;
        const y = ((frame * (2 + (i % 3)) + i * 40) % height);
        const radius = (i % 3) + 1.5;

        canvasCtx.beginPath();
        canvasCtx.arc(x, y, radius, 0, Math.PI * 2);
        canvasCtx.fill();
      }
    } else if (params.type === 'rain') {
      const dropCount = Math.floor(100 * intensity);
      canvasCtx.strokeStyle = 'rgba(200, 220, 255, 0.7)';
      canvasCtx.lineWidth = 1.5;
      for (let i = 0; i < dropCount; i++) {
        const x = (Math.sin(i * 133 + frame * 0.01) * 0.5 + 0.5) * width;
        const y = ((frame * 18 + i * 25) % height);
        const len = 12 + (i % 8);

        canvasCtx.beginPath();
        canvasCtx.moveTo(x, y);
        canvasCtx.lineTo(x - 2, y + len);
        canvasCtx.stroke();
      }
    } else if (params.type === 'dust' || params.type === 'embers') {
      const isEmbers = params.type === 'embers';
      const count = Math.floor(40 * intensity);
      canvasCtx.fillStyle = isEmbers ? '#ffaa33' : '#ffffff';
      for (let i = 0; i < count; i++) {
        const x = (Math.cos(i * 47 + frame * 0.03) * 0.5 + 0.5) * width;
        const y = isEmbers
          ? height - ((frame * 3 + i * 30) % height) // Float upward
          : (frame * 1.5 + i * 25) % height;
        const size = (i % 3) + 1;

        canvasCtx.fillRect(x, y, size, size);
      }
    }

    canvasCtx.restore();
  }
}
