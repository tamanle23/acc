import type { ModifierPlugin, ModifierContext, ClipRenderContext } from '../ModifierPluginRegistry';
import { Depth3DFactory, drawFrameBreakerFrame, resolveSubjectCutout, resolveDepthMapData } from '@acc/effect-engines';
import { createCanvas, type Image, type Canvas } from '@napi-rs/canvas';

export interface Depth3DPluginParams {
  mode: string; // 'frame_breaker' | 'volumetric_sandwich' | 'parallax' | 'depth_mesh' | ...
  frameStyle?: string;
  popOutIntensity?: number;
  autoSegment?: boolean;
  autoDepth?: boolean;
  depthMesh?: { motion?: string; displacementScale?: number };
  imagePath?: string;
  shadow?: boolean;
  floatMotion?: boolean;
  backdropBlur?: number;
}

/**
 * Depth3DPlugin:
 * Bridges existing 3D depth renderers (frame-breaker, sandwich, parallax, depth-mesh)
 * into a canonical IR visual modifier (`vfx/depth3d`).
 * Implements Phase 2: Sequence-Level Execution (Clip Space).
 */
export class Depth3DPlugin implements ModifierPlugin<Depth3DPluginParams> {
  public readonly type = 'vfx/depth3d';
  public readonly targetScope = 'sequence';
  public readonly targetPhase = 2;

  // Cache resolved cutouts and depth layers per sequence to maintain ZERO-ALLOC-FRAME-LOOP
  private cutoutCache = new Map<string, { subjectImg: Image | null; subjectBBox: any | null }>();
  private depthLayerCache = new Map<string, { srcCanvas: Canvas; depthLayers: any }>();
  private bgCanvasCache = new Map<string, Canvas>();

  public validate(params: unknown): params is Depth3DPluginParams {
    return Boolean(params && typeof params === 'object' && 'mode' in params);
  }

  public async execute(context: ModifierContext, params: Depth3DPluginParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.depth3d = {
      mode: params.mode || 'frame_breaker',
      frameStyle: params.frameStyle,
      popOutIntensity: params.popOutIntensity ?? 1.25,
      active: true,
    };

    // Pre-resolve AI subject cutout and Depth Anything layers during preflight
    if (params.imagePath) {
      const cutout = await resolveSubjectCutout(params.imagePath, params as any);
      this.cutoutCache.set(params.imagePath, cutout);

      const mode = params.mode || 'frame_breaker';
      if (mode === 'depth_map_3d' || mode === 'mesh_displacement' || params.autoDepth) {
        const depthData = await resolveDepthMapData(
          params.imagePath,
          context.canvas.width,
          context.canvas.height,
          params as any
        );
        this.depthLayerCache.set(params.imagePath, depthData);
      }
    }
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

    // Retrieve cached cutout if available
    let cutout = params.imagePath ? this.cutoutCache.get(params.imagePath) : undefined;
    if (!cutout && (baseAsset as any)._cutoutResolved === undefined) {
      // Synchronous attempt or empty fallback
      cutout = { subjectImg: null, subjectBBox: null };
    }

    // Build or retrieve cached dimmed background plate for frame_breaker
    let bgCanvas: Canvas | undefined;
    if (mode === 'frame_breaker' && params.imagePath) {
      bgCanvas = this.bgCanvasCache.get(params.imagePath);
      if (!bgCanvas) {
        bgCanvas = createCanvas(width, height);
        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.fillStyle = '#06060c';
        bgCtx.fillRect(0, 0, width, height);

        const imgRatio = baseAsset.width / baseAsset.height;
        const canvasRatio = width / height;
        let bgW = width;
        let bgH = height;
        let bgX = 0;
        let bgY = 0;

        if (imgRatio > canvasRatio) {
          bgW = width;
          bgH = width / imgRatio;
          bgY = (height - bgH) / 2;
        } else {
          bgH = height;
          bgW = height * imgRatio;
          bgX = (width - bgW) / 2;
        }

        bgCtx.drawImage(baseAsset, 0, 0, baseAsset.width, baseAsset.height, bgX, bgY, bgW, bgH);
        bgCtx.fillStyle = 'rgba(10, 10, 18, 0.65)';
        bgCtx.fillRect(bgX, bgY, bgW, bgH);
        this.bgCanvasCache.set(params.imagePath, bgCanvas);
      }
    }

    const depthConfig = {
      enabled: true,
      mode: mode as any,
      frameStyle: (params.frameStyle || 'polaroid') as any,
      popOutIntensity: params.popOutIntensity ?? 1.25,
      shadow: params.shadow !== false,
      floatMotion: params.floatMotion !== false,
    };

    const depthLayersData = params.imagePath ? this.depthLayerCache.get(params.imagePath) : undefined;

    const renderer = Depth3DFactory.getRenderer(mode);
    if (renderer) {
      renderer.renderFrame(canvasCtx, {
        img: baseAsset,
        subjectImg: cutout?.subjectImg || null,
        subjectBBox: cutout?.subjectBBox || null,
        bgCanvas: bgCanvas || null,
        srcCanvas: depthLayersData?.srcCanvas || null,
        depthLayers: depthLayersData?.depthLayers || null,
        width,
        height,
        frame: localFrame,
        totalFrames: totalSeqFrames,
        timeSec,
        progress,
        depthConfig,
      });
    } else {
      drawFrameBreakerFrame(canvasCtx, {
        img: baseAsset,
        subjectImg: cutout?.subjectImg || null,
        subjectBBox: cutout?.subjectBBox || null,
        bgCanvas: bgCanvas || null,
        width,
        height,
        frame: localFrame,
        totalFrames: totalSeqFrames,
        timeSec,
        progress,
        depthConfig,
      });
    }
  }
}

