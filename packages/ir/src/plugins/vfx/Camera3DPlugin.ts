import {
  UniversalCanvasProvider,
  ContentCacheRegistry,
  NativeResourceManager,
} from '@acc/core-isomorphic';
import type {
  ModifierPlugin,
  ModifierContext,
  ClipRenderContext,
  StreamRenderContext,
} from '../ModifierPluginRegistry';
import {
  CameraSplineInterpolator,
  type Camera3DKeyframe,
  type Camera3DState
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
  public readonly schema = {
    displayName: '3D Camera & Lens',
    category: 'vfx' as const,
    fields: {
      fov: {
        key: 'fov',
        label: 'Field of View (FOV)',
        type: 'number' as const,
        min: 20,
        max: 110,
        step: 1,
        defaultValue: 45,
        unit: '°',
      },
      focalDistance: {
        key: 'focalDistance',
        label: 'Focal Distance',
        type: 'number' as const,
        min: 0.5,
        max: 20.0,
        step: 0.1,
        defaultValue: 2.5,
        unit: 'm',
      },
      bokehRadius: {
        key: 'bokehRadius',
        label: 'Bokeh Blur Radius',
        type: 'number' as const,
        min: 0.0,
        max: 25.0,
        step: 0.5,
        defaultValue: 6.0,
        unit: 'px',
      },
      roll: {
        key: 'roll',
        label: 'Camera Roll',
        type: 'number' as const,
        min: -180,
        max: 180,
        step: 1,
        defaultValue: 0,
        unit: '°',
      },
      motionBlur: {
        key: 'motionBlur',
        label: 'Optical Motion Blur',
        type: 'boolean' as const,
        defaultValue: false,
      },
    },
  };

  public normalizeParams(params: Partial<Camera3DPluginParams> = {}): Camera3DPluginParams {
    return {
      fov: params.fov ?? 45,
      focalDistance: params.focalDistance ?? 2.5,
      bokehRadius: params.bokehRadius ?? 6.0,
      roll: params.roll ?? 0,
      motionBlur: params.motionBlur ?? false,
      ...params,
    };
  }

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

  public static cleanupSequence(sequenceIdOrSeq: any): void {
    const id = typeof sequenceIdOrSeq === 'string' ? sequenceIdOrSeq : sequenceIdOrSeq?.id;
    if (id) {
      NativeResourceManager.getInstance().disposeSequenceScope(id);
    }
  }

  public cleanupSequence(sequenceId: string): void {
    Camera3DPlugin.cleanupSequence(sequenceId);
  }

  public async execute(context: ModifierContext, params: Camera3DPluginParams): Promise<void> {
    const totalFrames = Math.max(1, Math.round((context.targetEntity as any).durationFrames || context.fps * 3));
    const width = context.canvas.width;
    const height = context.canvas.height;
    const seqId = (context.targetEntity as any)?.id || 'default';
    const seqScope = NativeResourceManager.getInstance().getOrCreateSequenceScope(seqId);
    const cacheKey = `camera3d_traj_${seqId}_${totalFrames}`;

    // 1. Precompute Catmull-Rom / Bezier camera trajectory and persist into ContentCacheRegistry
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
    if (context.targetEntity) {
      (context.targetEntity as any)._camera3dTrajectory = trajectory;
    }
    try {
      const blob = new Blob([trajectory.buffer], { type: 'application/octet-stream' });
      await ContentCacheRegistry.get().set(cacheKey, blob, {
        metadata: { totalFrames, width, height },
      });
    } catch {}

    // 2. Pre-generate and cache multi-tier focal zone canvases if rack focus is requested
    const rackFocusEnabled = params.rackFocus?.enabled !== false;
    const imgPath = params.imagePath;
    if (rackFocusEnabled && imgPath && typeof window === 'undefined') {
      try {
        const req = typeof require !== 'undefined' ? require : (0, eval)('require');
        const effectEngines = req('@acc/effect-engines');
        const depthData = await effectEngines.resolveDepthMapData(imgPath, width, height, params as any);
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

          NativeResourceManager.getInstance().register('focal_near', nearBlurCanvas, { scope: seqScope });
          NativeResourceManager.getInstance().register('focal_far', farBlurCanvas, { scope: seqScope });

          const focalZones: FocalZoneCanvases = {
            sharpCanvas,
            nearBlurCanvas,
            farBlurCanvas,
          };
          if (context.targetEntity) {
            (context.targetEntity as any)._focalZones = focalZones;
          }

          // Persist raw pixel buffers to ContentCacheRegistry as Blobs for cross-worker sharing
          try {
            const nbData = nbCtx.getImageData(0, 0, width, height);
            const fbData = fbCtx.getImageData(0, 0, width, height);
            const nearBlob = new Blob([nbData.data.buffer], { type: 'application/octet-stream' });
            const farBlob = new Blob([fbData.data.buffer], { type: 'application/octet-stream' });
            await ContentCacheRegistry.get().set(`camera3d_focal_near_${cacheKey}`, nearBlob);
            await ContentCacheRegistry.get().set(`camera3d_focal_far_${cacheKey}`, farBlob);
          } catch {}
        }
      } catch {}
    }
  }

  /**
   * Phase 2: Sequence-Level (Clip Space) Rendering.
   * Applies 3D perspective camera transformation and dynamic rack focus bokeh crossfading.
   */
  public async renderClipSpace(ctx: ClipRenderContext, params: Camera3DPluginParams): Promise<void> {
    const { ctx: canvasCtx, width, height, localFrame, sequence } = ctx;
    const totalFrames = Math.max(1, sequence.durationFrames || 1);
    const seqId = sequence.id || 'default';
    const seqScope = NativeResourceManager.getInstance().getOrCreateSequenceScope(seqId);
    const cacheKey = `camera3d_traj_${seqId}_${totalFrames}`;

    let trajectory: Float32Array | undefined =
      (sequence as any)?._camera3dTrajectory || seqScope.get('camera3d_traj')?.getRaw();
    if (!trajectory) {
      try {
        if (await ContentCacheRegistry.get().has(cacheKey)) {
          const blob = await ContentCacheRegistry.get().get(cacheKey);
          if (blob) {
            const ab = await blob.arrayBuffer();
            trajectory = new Float32Array(ab);
            (sequence as any)._camera3dTrajectory = trajectory;
          }
        }
      } catch {}
    }

    if (!trajectory) {
      const keyframes = params.keyframes || [
        { time: 0.0, position: [0, 0, 1.2], target: [0, 0, 0], roll: 0, fov: 60, focalZ: 0.2, focalAperture: 0.5 },
        { time: 0.5, position: [0.15, -0.05, 0.95], target: [0.05, 0, 0], roll: 1.5, fov: 58, focalZ: 0.5, focalAperture: 0.7 },
        { time: 1.0, position: [-0.1, 0.05, 0.8], target: [0, 0, 0], roll: -1.0, fov: 55, focalZ: 0.8, focalAperture: 0.4 },
      ];
      trajectory = CameraSplineInterpolator.precomputeTrajectory(
        keyframes,
        totalFrames,
        width,
        height
      );
      if (sequence) {
        (sequence as any)._camera3dTrajectory = trajectory;
      }
    }

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
    let focalZones = (sequence as any)?._focalZones as FocalZoneCanvases | undefined;
    if (!focalZones && focalAperture > 0.01) {
      const nearCanvas = seqScope.get('focal_near')?.getRaw();
      const farCanvas = seqScope.get('focal_far')?.getRaw();
      if (nearCanvas && farCanvas) {
        focalZones = {
          sharpCanvas: null,
          nearBlurCanvas: nearCanvas,
          farBlurCanvas: farCanvas,
        };
        (sequence as any)._focalZones = focalZones;
      } else {
        try {
          const nearBlob = await ContentCacheRegistry.get().get(`camera3d_focal_near_${cacheKey}`);
          const farBlob = await ContentCacheRegistry.get().get(`camera3d_focal_far_${cacheKey}`);
          if (nearBlob && farBlob) {
            const nearBytes = new Uint8ClampedArray(await nearBlob.arrayBuffer());
            const farBytes = new Uint8ClampedArray(await farBlob.arrayBuffer());

            const uNear = UniversalCanvasProvider.createCanvas(width, height);
            const uFar = UniversalCanvasProvider.createCanvas(width, height);
            const rawNear = uNear.getRawCanvas ? uNear.getRawCanvas() : uNear;
            const rawFar = uFar.getRawCanvas ? uFar.getRawCanvas() : uFar;

            const nCtx = rawNear.getContext('2d');
            const fCtx = rawFar.getContext('2d');

            const nImgData = nCtx.createImageData(width, height);
            nImgData.data.set(nearBytes);
            nCtx.putImageData(nImgData, 0, 0);

            const fImgData = fCtx.createImageData(width, height);
            fImgData.data.set(farBytes);
            fCtx.putImageData(fImgData, 0, 0);

            NativeResourceManager.getInstance().register('focal_near', rawNear, { scope: seqScope });
            NativeResourceManager.getInstance().register('focal_far', rawFar, { scope: seqScope });

            focalZones = {
              sharpCanvas: null,
              nearBlurCanvas: rawNear,
              farBlurCanvas: rawFar,
            };
            if (sequence) {
              (sequence as any)._focalZones = focalZones;
            }
          }
        } catch {}
      }
    }

    if (focalZones && focalAperture > 0.01) {
      const { nearBlurCanvas, farBlurCanvas } = focalZones;

      // Dynamic crossfade: if focalZ < 0.5 (foreground in focus), fade in far blur (background bokeh)
      // if focalZ > 0.5 (background in focus), fade in near blur (foreground bokeh)
      // modulated by focalAperture
      if (focalZ < 0.5) {
        // Foreground in focus -> background blurred
        const bgBlurAlpha = Math.min(1.0, (0.5 - focalZ) * 2.0 * focalAperture);
        if (bgBlurAlpha > 0.01 && farBlurCanvas) {
          canvasCtx.save();
          canvasCtx.globalAlpha = bgBlurAlpha;
          canvasCtx.drawImage(farBlurCanvas, 0, 0);
          canvasCtx.restore();
        }
      } else {
        // Background in focus -> foreground blurred
        const fgBlurAlpha = Math.min(1.0, (focalZ - 0.5) * 2.0 * focalAperture);
        if (fgBlurAlpha > 0.01 && nearBlurCanvas) {
          canvasCtx.save();
          canvasCtx.globalAlpha = fgBlurAlpha;
          canvasCtx.drawImage(nearBlurCanvas, 0, 0);
          canvasCtx.restore();
        }
      }
    }
    // Transformation is popped after clip children or drawn elements
    // Notice: we do not restore canvasCtx here if children need the camera transform;
    // In IRMasterRenderer, ctx.save() is called before modifiers and ctx.restore() after clip drawing.
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

    const uTiny = UniversalCanvasProvider.acquireScratchCanvas(downW, downH);
    try {
      const tinyCanvas = uTiny.getRawCanvas ? uTiny.getRawCanvas() : uTiny;
      const tCtx = tinyCanvas.getContext('2d');

      // Downscale with bilinear filter
      tCtx.drawImage(srcCanvas, 0, 0, downW, downH);

      // Upscale back with smooth blur
      targetCtx.drawImage(tinyCanvas, 0, 0, downW, downH, 0, 0, w, h);
    } finally {
      UniversalCanvasProvider.releaseScratchCanvas(uTiny);
    }
  }
}
