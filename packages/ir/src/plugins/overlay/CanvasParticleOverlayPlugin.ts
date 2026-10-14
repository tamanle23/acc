import type { ModifierPlugin, ModifierContext, StreamRenderContext } from '../ModifierPluginRegistry';

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

export interface CanvasParticleOverlayParams {
  type: ProceduralParticleType | string;
  variant?: string;
  intensity?: number;
  speed?: number;
  opacity?: number;
}

/**
 * CanvasParticleOverlayPlugin:
 * Implements Section 3.3 of Document 7 (`overlay/luma_particle_canvas` & `overlay/alpha_particle_canvas`).
 * Renders procedural particles (Rain, Snow, Dust, Embers, Fire, VHS, Glitch, HUD) directly onto the canvas.
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
    const pType = (params.type || 'snow').toLowerCase();

    canvasCtx.save();
    canvasCtx.globalAlpha = opacity;

    if (pType === 'snow') {
      const flakeCount = Math.floor(60 * intensity);
      canvasCtx.fillStyle = '#ffffff';
      for (let i = 0; i < flakeCount; i++) {
        const x = (Math.sin(i * 99 + frame * 0.02) * 0.5 + 0.5) * width;
        const y = ((frame * (2 + (i % 3)) + i * 40) % height);
        const radius = (i % 3) + 1.5;

        canvasCtx.beginPath();
        canvasCtx.arc(x, y, radius, 0, Math.PI * 2);
        canvasCtx.fill();
      }
    } else if (pType === 'rain') {
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
    } else if (pType === 'dust' || pType === 'embers') {
      const isEmbers = pType === 'embers';
      const count = Math.floor(40 * intensity);
      canvasCtx.fillStyle = isEmbers ? '#ffaa33' : '#ffffff';
      for (let i = 0; i < count; i++) {
        const x = (Math.cos(i * 47 + frame * 0.03) * 0.5 + 0.5) * width;
        const y = isEmbers
          ? height - ((frame * 3 + i * 30) % height)
          : (frame * 1.5 + i * 25) % height;
        const size = (i % 3) + 1;

        canvasCtx.fillRect(x, y, size, size);
      }
    } else if (pType === 'fire') {
      const flameCount = Math.floor(30 * intensity);
      for (let i = 0; i < flameCount; i++) {
        const x = ((i * (width / flameCount) + Math.sin(frame * 0.08 + i) * 15) % width);
        const flameHeight = 80 + (Math.cos(frame * 0.12 + i * 17) * 0.5 + 0.5) * 120;
        const y = height - (flameHeight * 0.5);

        const grad = canvasCtx.createRadialGradient(x, y, 5, x, y, flameHeight * 0.6);
        grad.addColorStop(0, 'rgba(255, 220, 100, 0.85)');
        grad.addColorStop(0.4, 'rgba(255, 100, 20, 0.6)');
        grad.addColorStop(1, 'rgba(200, 20, 0, 0)');

        canvasCtx.fillStyle = grad;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, flameHeight * 0.6, 0, Math.PI * 2);
        canvasCtx.fill();
      }
    } else if (pType === 'vhs') {
      // VHS tracking lines & scanlines
      const lineY = (frame * 5) % height;
      canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      canvasCtx.fillRect(0, lineY, width, 4);

      // Subtle scanline overlay
      canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let y = 0; y < height; y += 4) {
        canvasCtx.fillRect(0, y, width, 1.5);
      }
    } else if (pType === 'digital_glitch') {
      const glitchBlocks = Math.floor(6 * intensity);
      canvasCtx.fillStyle = 'rgba(0, 240, 255, 0.2)';
      for (let i = 0; i < glitchBlocks; i++) {
        const gx = ((Math.sin(frame * 7 + i * 13) * 0.5 + 0.5) * width);
        const gy = ((Math.cos(frame * 11 + i * 19) * 0.5 + 0.5) * height);
        const gw = 40 + (i % 4) * 50;
        const gh = 6 + (i % 3) * 8;
        canvasCtx.fillRect(gx, gy, gw, gh);
      }
    } else if (pType === 'bokeh') {
      const circleCount = Math.floor(18 * intensity);
      for (let i = 0; i < circleCount; i++) {
        const bx = (Math.sin(i * 31 + frame * 0.01) * 0.5 + 0.5) * width;
        const by = (Math.cos(i * 53 + frame * 0.015) * 0.5 + 0.5) * height;
        const r = 25 + (i % 5) * 15;

        canvasCtx.fillStyle = `rgba(255, 240, 200, 0.12)`;
        canvasCtx.beginPath();
        canvasCtx.arc(bx, by, r, 0, Math.PI * 2);
        canvasCtx.fill();
      }
    } else if (pType === 'sci_fi_hud') {
      // Reticle and tech framing
      canvasCtx.strokeStyle = 'rgba(0, 220, 255, 0.4)';
      canvasCtx.lineWidth = 1.5;
      const cx = width / 2;
      const cy = height / 2;
      const reticleRadius = 60;
      canvasCtx.beginPath();
      canvasCtx.arc(cx, cy, reticleRadius, 0, Math.PI * 2);
      canvasCtx.stroke();

      canvasCtx.beginPath();
      canvasCtx.moveTo(cx - reticleRadius - 15, cy);
      canvasCtx.lineTo(cx + reticleRadius + 15, cy);
      canvasCtx.moveTo(cx, cy - reticleRadius - 15);
      canvasCtx.lineTo(cx, cy + reticleRadius + 15);
      canvasCtx.stroke();
    } else {
      // Generic particle fallback
      const count = Math.floor(30 * intensity);
      canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (let i = 0; i < count; i++) {
        const x = (Math.sin(i * 77 + frame * 0.015) * 0.5 + 0.5) * width;
        const y = ((frame * 2 + i * 35) % height);
        canvasCtx.fillRect(x, y, 2, 2);
      }
    }

    canvasCtx.restore();
  }
}
