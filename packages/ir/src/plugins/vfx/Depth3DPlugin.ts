import type { ModifierPlugin, ModifierContext, ClipRenderContext } from '../ModifierPluginRegistry';
import { Depth3DFactory, drawFrameBreakerFrame } from '@acc/effect-engines';

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
   * Renders the 3D frame border, floating motion, and pop-out effect directly onto the canvas.
   */
  public renderClipSpace(ctx: ClipRenderContext, params: Depth3DPluginParams): void {
    const { ctx: canvasCtx, width, height, localFrame, sequence, baseAsset } = ctx;
    if (!baseAsset) return;

    const mode = params.mode || 'frame_breaker';
    const totalSeqFrames = sequence.durationFrames || 1;
    const progress = localFrame / totalSeqFrames;
    const timeSec = localFrame / 30; // Approx 30fps

    const renderer = Depth3DFactory.getRenderer(mode);
    if (renderer) {
      renderer.renderFrame(canvasCtx, {
        img: baseAsset,
        subjectImg: null,
        width,
        height,
        frame: localFrame,
        totalFrames: totalSeqFrames,
        timeSec,
        progress,
        depthConfig: {
          enabled: true,
          mode: mode as any,
          frameStyle: (params.frameStyle || 'card') as any,
          popOutIntensity: params.popOutIntensity ?? 1.2,
          shadow: true,
          floatMotion: true,
        },
      });
    } else {
      drawFrameBreakerFrame(canvasCtx, {
        img: baseAsset,
        subjectImg: null,
        width,
        height,
        frame: localFrame,
        totalFrames: totalSeqFrames,
        timeSec,
        progress,
        depthConfig: {
          enabled: true,
          mode: 'frame_breaker',
          frameStyle: (params.frameStyle || 'card') as any,
          popOutIntensity: params.popOutIntensity ?? 1.2,
          shadow: true,
          floatMotion: true,
        },
      });
    }
  }
}

