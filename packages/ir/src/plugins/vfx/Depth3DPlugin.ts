import type { ModifierPlugin, ModifierContext, ClipRenderContext } from '../ModifierPluginRegistry';

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
 * Implements Phase 2: Sequence-Level Execution (Clip Space).
 */
export class Depth3DPlugin implements ModifierPlugin<Depth3DPluginParams> {
  public readonly type = 'vfx/depth3d';
  public readonly targetScope = 'sequence';
  public readonly targetPhase = 2;

  public validate(params: unknown): params is Depth3DPluginParams {
    return Boolean(params && typeof params === 'object' && 'mode' in params);
  }

  public async execute(context: ModifierContext, params: Depth3DPluginParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.depth3d = {
      mode: params.mode || 'frame_breaker',
      frameStyle: params.frameStyle,
      popOutIntensity: params.popOutIntensity ?? 1.0,
      active: true,
    };
  }

  /**
   * Phase 2: Clip Space Rendering.
   * Renders the 3D frame border and pop-out effect directly onto the canvas.
   */
  public renderClipSpace(ctx: ClipRenderContext, params: Depth3DPluginParams): void {
    const { ctx: canvasCtx, width, height, localFrame } = ctx;
    const style = params.frameStyle || 'polaroid';
    const intensity = params.popOutIntensity ?? 1.0;

    // Draw stylized card border around the frame
    const margin = Math.round(Math.min(width, height) * 0.05);
    const cardW = width - margin * 2;
    const cardH = height - margin * 2;

    canvasCtx.save();
    canvasCtx.lineWidth = style === 'comic' ? 8 : 4;
    canvasCtx.strokeStyle = style === 'comic' ? '#ffffff' : '#e2e8f0';

    // Draw card boundary
    canvasCtx.strokeRect(margin, margin, cardW, cardH);

    // Subtle breathing parallax zoom
    const zoom = 1.0 + Math.sin(localFrame * 0.05) * 0.015 * intensity;
    const centerX = width / 2;
    const centerY = height / 2;

    canvasCtx.translate(centerX, centerY);
    canvasCtx.scale(zoom, zoom);
    canvasCtx.translate(-centerX, -centerY);
    canvasCtx.restore();
  }
}

