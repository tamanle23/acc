import fs from 'fs';
import type {
  ModifierPlugin,
  ModifierContext,
  ClipRenderContext,
  StreamRenderContext,
} from '../ModifierPluginRegistry';
import {
  CameraSplineInterpolator,
  type Camera3DKeyframe,
  type Camera3DState,
  resolveDepthMapData,
  UniversalCanvasProvider,
} from '@acc/effect-engines';

export interface Camera3DPluginParams {
  keyframes?: Camera3DKeyframe[];
  rackFocus?: {
    enabled?: boolean;
    focalZone?: 'foreground' | 'midground' | 'background' | 'custom';
    customFocalZ?: number;
    aperture?: number; // Blur intensity [0.0, 1.0]
    blurMaxRadius?: number; // max blur radius in px
  };
  imagePath?: string;
  depthImagePath?: string;
  motionBlur?: boolean;
  [key: string]: any;
}

interface FocalZoneCanvases {
  sharpCanvas: any;
  nearBlurCanvas: any;
  farBlurCanvas: any;
}

/**
 * Camera3DPlugin:
 * Implements Phase 2: Cinematic 3D Camera Path Sequencer & Dynamic Rack Focus.
 * Operates at Sequence-Level (targetPhase: 2) and optionally Stream-Level (targetPhase: 3).
 *
 * Adheres strictly to ZERO-ALLOC-FRAME-LOOP:
 * - Pre-computes 3D trajectory matrices into Float32Array buffers during preflight (execute()).
 * - Pre-blurs multi-tier focal zone canvases once during preflight.
 * - Applies zero-allocation matrix transforms and alpha crossfades per frame.
 * - Zero direct calls to bun:ffi, fluent-ffmpeg, or mediabunny.
 */
export class Camera3DPlugin implements ModifierPlugin<Camera3DPluginParams> {
  public readonly type = 'vfx/camera_3d';
  public readonly targetScope = 'sequence';
  public readonly targetPhase = 2;

  // Cached pre-computed trajectory arrays per sequence/asset
  private trajectoryCache = new Map<string, Float32Array>();
  // Cached pre-blurred focal zone layers
  private focalZoneCache = new Map<string, FocalZoneCanvases>();
  // Reusable scratch camera state to prevent heap allocations
  private scratchCameraState: Camera3DState = {
    x: 0,
    y: 0,
    z: 1,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    roll: 0,
    fov: 60,
    focalZ: 0.5,
    focalAperture: 0,
    scale: 1,
    transX: 0,
    transY: 0,
    rotationRad: 0,
  };

  public validate(params: unknown): params is Camera3DPluginParams {
    return Boolean(params && typeof params === 'object');
  }

  public async execute(context: ModifierContext, params: Camera3DPluginParams): Promise<void> {
    const totalFrames = Math.max(1, Math.round((context.targetEntity as any).durationFrames || context.fps * 3));
    const width = context.canvas.width;
    const height = context.canvas.height;
    const cacheKey = `${(context.targetEntity as any).id || 'default'}_${totalFrames}`;

    // 1. Precompute Catmull-Rom / Bezier camera trajectory
    const keyframes = params.keyframes || [
      { time: 0.0, position: [0, 0, 1.2], target: [0, 0, 0], roll: 0, fov: 60, focalZ: 0.2, focalAperture: 0.5 },
      { time: 0.5, position: [0.15, -0.05, 0.95], target: [0.05, 0, 0], roll: 1.5, fov: 58, focalZ: 0.5, focalAperture: 0.7 },
      { time: 1.0, position: [-0.1, 0.05, 0.8], target: [0, 0, 0], roll: -1.0, fov: 55, focalZ: 0.8, focalAperture: 0.4 },
    ];

    const trajectory = CameraSplineInterpolator.precomputeTrajectory(
      keyframes,
      totalFrames,
      width,
      height
    );
    this.trajectoryCache.set(cacheKey, trajectory);

    // 2. Pre-generate and cache multi-tier focal zone canvases if rack focus is requested
    const rackFocusEnabled = params.rackFocus?.enabled !== false;
    const imgPath = params.imagePath;
    const fileExists = typeof fs?.existsSync === 'function' && Boolean(imgPath && fs.existsSync(imgPath));
    if (rackFocusEnabled && imgPath && fileExists) {
      try {
        const depthData = await resolveDepthMapData(imgPath, width, height, params as any);
        if (depthData?.srcCanvas) {
          const sharpCanvas = depthData.srcCanvas;

          // Generate near-blur (foreground bokeh) and far-blur (background bokeh)
          const uNear = UniversalCanvasProvider.createCanvas(width, height);
          const uFar = UniversalCanvasProvider.createCanvas(width, height);
          const nearBlurCanvas = uNear.getRawCanvas ? uNear.getRawCanvas() : uNear;
          const farBlurCanvas = uFar.getRawCanvas ? uFar.getRawCanvas() : uFar;

          const nbCtx = nearBlurCanvas.getContext('2d');
          const fbCtx = farBlurCanvas.getContext('2d');

          // Draw base image with multi-pass box blur simulation
          this.drawFastBlurred(nbCtx, sharpCanvas, width, height, 8);
          this.drawFastBlurred(fbCtx, sharpCanvas, width, height, 16);

          this.focalZoneCache.set(cacheKey, {
            sharpCanvas,
            nearBlurCanvas,
            farBlurCanvas,
          });
        }
      } catch {}
    }
  }

  /**
   * Phase 2: Sequence-Level (Clip Space) Rendering.
   * Applies 3D perspective camera transformation and dynamic rack focus bokeh crossfading.
   */
  public renderClipSpace(ctx: ClipRenderContext, params: Camera3DPluginParams): void {
    const { ctx: canvasCtx, width, height, localFrame, sequence } = ctx;
    const totalFrames = Math.max(1, sequence.durationFrames || 1);
    const cacheKey = `${sequence.id || 'default'}_${totalFrames}`;

    const trajectory = this.trajectoryCache.get(cacheKey);
    if (!trajectory) return;

    // Unpack camera state in zero-alloc scratch structure
    CameraSplineInterpolator.readFrameState(
      trajectory,
      localFrame,
      width,
      height,
      this.scratchCameraState
    );

    const { scale, transX, transY, rotationRad, focalZ, focalAperture } = this.scratchCameraState;

    // Apply 3D Camera Affine Transform to clip space canvas
    canvasCtx.save();
    try {
      const centerX = width / 2;
      const centerY = height / 2;

      // Translate to center, apply camera zoom (scale), translation, and roll rotation
      canvasCtx.translate(centerX + transX, centerY + transY);
      if (rotationRad !== 0) {
        canvasCtx.rotate(rotationRad);
      }
      canvasCtx.scale(scale, scale);
      canvasCtx.translate(-centerX, -centerY);

      // Render Dynamic Rack Focus crossfade if focal zones exist
      const focalZones = this.focalZoneCache.get(cacheKey);
      if (focalZones && focalAperture > 0.01) {
        const { nearBlurCanvas, farBlurCanvas } = focalZones;

        // Dynamic crossfade: if focalZ < 0.4 (focused on near), fade in far blur
        // if focalZ > 0.6 (focused on far), fade in near blur
        // modulated by focalAperture
        if (focalZ < 0.5) {
          // Foreground in focus -> background blurred
          const bgBlurAlpha = Math.min(1.0, (0.5 - focalZ) * 2.0 * focalAperture);
          if (bgBlurAlpha > 0.01) {
            canvasCtx.save();
            canvasCtx.globalAlpha = bgBlurAlpha;
            canvasCtx.drawImage(farBlurCanvas, 0, 0);
            canvasCtx.restore();
          }
        } else {
          // Background in focus -> foreground blurred
          const fgBlurAlpha = Math.min(1.0, (focalZ - 0.5) * 2.0 * focalAperture);
          if (fgBlurAlpha > 0.01) {
            canvasCtx.save();
            canvasCtx.globalAlpha = fgBlurAlpha;
            canvasCtx.drawImage(nearBlurCanvas, 0, 0);
            canvasCtx.restore();
          }
        }
      }
    } finally {
      // Transformation is popped after clip children or drawn elements
      // Notice: we do not restore canvasCtx here if children need the camera transform;
      // In IRMasterRenderer, ctx.save() is called before modifiers and ctx.restore() after clip drawing.
    }
  }

  /**
   * Phase 3: Stream-Level rendering support for whole tracks.
   */
  public renderStreamSpace(ctx: StreamRenderContext, params: Camera3DPluginParams): void {
    // If track-level camera shake or drift is desired, apply similarly to stream canvas
  }

  /**
   * Fast multi-pass box blur simulation using downsampling and bilinear interpolation.
   * Eliminates heavy per-pixel CPU convolution while maintaining 60fps performance.
   */
  private drawFastBlurred(
    targetCtx: any,
    srcCanvas: any,
    w: number,
    h: number,
    blurLevel: number
  ): void {
    const downW = Math.max(8, Math.round(w / (blurLevel * 2)));
    const downH = Math.max(8, Math.round(h / (blurLevel * 2)));

    const uTiny = UniversalCanvasProvider.createCanvas(downW, downH);
    const tinyCanvas = uTiny.getRawCanvas ? uTiny.getRawCanvas() : uTiny;
    const tCtx = tinyCanvas.getContext('2d');

    // Downscale with bilinear filter
    tCtx.drawImage(srcCanvas, 0, 0, downW, downH);

    // Upscale back with smooth blur
    targetCtx.drawImage(tinyCanvas, 0, 0, downW, downH, 0, 0, w, h);
  }
}
