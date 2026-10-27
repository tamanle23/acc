import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import type { ModifierPlugin, ModifierContext, ClipRenderContext } from '../ModifierPluginRegistry';
import {
  Depth3DFactory,
  drawFrameBreakerFrame,
  SurfaceNormalGenerator,
  type SurfaceNormalMap,
  type RelightingParams,
} from '@acc/effect-engines';

export type Depth3DMode =
  | 'frame_breaker'
  | 'parallax_25d'
  | 'parallax_dolly'
  | 'volumetric_sandwich'
  | 'sandwich'
  | 'depth_map_3d'
  | 'mesh_displacement'
  | 'wigglegram'
  | 'isometric_podium'
  | 'cutout_portal'
  | 'gyro_focal_tilt'
  | 'flythrough_carousel'
  | 'diffuse_shadow'
  | 'glassmorphic_fresnel'
  | 'silhouette_rim_light'
  | 'plane_cast_shadow'
  | 'macro_bokeh'
  | 'aerial_mist'
  | 'rack_focus'
  | 'vignette_tunnel'
  | 'perspective_grid'
  | 'extruded_text_3d'
  | 'isometric_billboard'
  | 'tunneling_text';

export interface Depth3DPluginParams {
  mode: Depth3DMode | string;
  frameStyle?: string;
  popOutIntensity?: number;
  autoSegment?: boolean;
  autoDepth?: boolean;
  relighting?: RelightingParams;
  depthMesh?: { motion?: string; displacementScale?: number };
  sandwich?: any;
  parallax?: any;
  captions?: any[];
  imagePath?: string;
  shadow?: boolean;
  floatMotion?: boolean;
  backdropBlur?: number;
  [key: string]: any;
}

/**
 * Depth3DPlugin:
 * Bridges all 17 3D depth renderers into a canonical IR visual modifier (`vfx/depth3d`).
 * Implements Phase 2: Sequence-Level Execution (Clip Space).
 */
export class Depth3DPlugin implements ModifierPlugin<Depth3DPluginParams> {
  public readonly type = 'vfx/depth3d';
  public readonly targetScope = 'sequence';
  public readonly targetPhase = 2;
  public readonly schema = {
    fields: {
      depthStrategy: {
        key: 'depthStrategy',
        label: 'Depth Estimation Strategy',
        type: 'vision_depth_strategy' as const,
        defaultValue: 'heuristic',
      },
      segmentationStrategy: {
        key: 'segmentationStrategy',
        label: 'Subject Cutout Strategy',
        type: 'vision_segmentation_strategy' as const,
        defaultValue: 'grabcut-fallback',
      },
      mode: {
        key: 'mode',
        label: '3D Depth Projection Mode',
        type: 'select' as const,
        defaultValue: 'frame_breaker',
        options: [
          { label: 'Frame Breaker Pop-Out', value: 'frame_breaker' },
          { label: '2.5D Parallax Plane', value: 'parallax_25d' },
          { label: 'Dolly Zoom Push', value: 'parallax_dolly' },
          { label: 'Volumetric Sandwich', value: 'volumetric_sandwich' },
          { label: 'Silhouette Rim Light', value: 'silhouette_rim_light' },
          { label: 'Depth Disparity Heatmap', value: 'depth_heatmap' },
        ],
      },
      popOutIntensity: {
        key: 'popOutIntensity',
        label: 'Pop-Out Intensity',
        type: 'number' as const,
        min: 0.5,
        max: 3.0,
        step: 0.05,
        defaultValue: 1.25,
      },
      backdropBlur: {
        key: 'backdropBlur',
        label: 'Backdrop Blur Radius',
        type: 'number' as const,
        min: 0,
        max: 32,
        step: 1,
        defaultValue: 8,
        unit: 'px',
      },
      floatMotion: {
        key: 'floatMotion',
        label: 'Organic Floating Motion',
        type: 'boolean' as const,
        defaultValue: true,
      },
      shadow: {
        key: 'shadow',
        label: 'Drop Shadow Depth',
        type: 'boolean' as const,
        defaultValue: true,
      },
    },
  };

  // Cache resolved cutouts and depth layers per sequence to maintain ZERO-ALLOC-FRAME-LOOP
  private cutoutCache = new Map<string, { subjectImg: any | null; subjectBBox: any | null }>();
  private depthLayerCache = new Map<string, { srcCanvas: any; depthLayers: any }>();
  private bgCanvasCache = new Map<string, any>();
  private particlesCache = new Map<string, any[]>();
  private dustParticlesCache = new Map<string, any[]>();
  private baseCanvasCache = new Map<string, any>();
  private normalMapCache = new Map<string, SurfaceNormalMap>();
  private relightCanvasCache = new Map<string, { canvas: any; ctx: any }>();

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
    if (params.imagePath && typeof window === 'undefined') {
      try {
        const req = typeof require !== 'undefined' ? require : (0, eval)('require');
        const effectEngines = req('@acc/effect-engines');
        const cutout = await effectEngines.resolveSubjectCutout(params.imagePath, params as any);
        this.cutoutCache.set(params.imagePath, cutout);
      } catch { }

      const mode = params.mode || 'frame_breaker';
      const width = context.canvas.width;
      const height = context.canvas.height;

      if (mode === 'depth_map_3d' || mode === 'mesh_displacement' || params.autoDepth || params.relighting?.enabled) {
        try {
          const req = typeof require !== 'undefined' ? require : (0, eval)('require');
          const effectEngines = req('@acc/effect-engines');
          const depthData = await effectEngines.resolveDepthMapData(
            params.imagePath,
            width,
            height,
            params as any
          );
          this.depthLayerCache.set(params.imagePath, depthData);

          // If relighting is requested, compute surface normal map once during preflight to adhere to ZERO-ALLOC-FRAME-LOOP
          if (params.relighting?.enabled && depthData?.srcCanvas) {
            const dCtx = depthData.srcCanvas.getContext('2d');
            const depthImgData = dCtx.getImageData(0, 0, width, height);
            const normalMap = SurfaceNormalGenerator.generateFromDepth(
              depthImgData.data,
              width,
              height,
              4,
              params.relighting.normalStrength ?? 2.0
            );
            this.normalMapCache.set(params.imagePath, normalMap);

            // Pre-allocate scratch canvas for relight compositing
            const relightCanvas = UniversalCanvasProvider.acquireScratchCanvas(width, height);
            const rCtx = relightCanvas.getContext('2d');
            this.relightCanvasCache.set(params.imagePath, { canvas: relightCanvas.getRawCanvas ? relightCanvas.getRawCanvas() : relightCanvas, ctx: rCtx });
          }
        } catch { }
      }

      if (mode === 'parallax_25d' || mode === 'parallax_dolly') {
        const particles = Array.from({ length: 28 }, (_, i) => ({
          x: (Math.sin(i * 99) * 0.5 + 0.5) * width,
          y: (Math.cos(i * 33) * 0.5 + 0.5) * height,
          size: 3 + (i % 6) * 3,
          speedX: (0.4 + (i % 3) * 0.3) * (i % 2 === 0 ? 1 : -1),
          speedY: -0.5 - (i % 4) * 0.4,
          opacity: 0.2 + (i % 5) * 0.12,
          pulseSpeed: 1.5 + (i % 3),
        }));
        this.particlesCache.set(params.imagePath, particles);
      } else if (mode === 'volumetric_sandwich' || mode === 'sandwich') {
        const dustParticles = Array.from({ length: 35 }, (_, i) => ({
          x: (Math.sin(i * 47) * 0.5 + 0.5) * width,
          y: (Math.cos(i * 83) * 0.5 + 0.5) * height,
          size: 2 + (i % 4) * 2,
          speedX: (0.2 + (i % 3) * 0.2) * (i % 2 === 0 ? 1 : -1),
          speedY: -0.3 - (i % 3) * 0.2,
          opacity: 0.15 + (i % 4) * 0.1,
        }));
        this.dustParticlesCache.set(params.imagePath, dustParticles);
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
    // Restrict Depth3DPlugin processing exclusively to image sequence types
    if (sequence.type && sequence.type !== 'image') return;

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
    let bgCanvas: any | undefined;
    if (mode === 'frame_breaker' && params.imagePath) {
      bgCanvas = this.bgCanvasCache.get(params.imagePath);
      if (!bgCanvas) {
        const uCanvas = UniversalCanvasProvider.acquireScratchCanvas(width, height);
        bgCanvas = uCanvas.getRawCanvas ? uCanvas.getRawCanvas() : uCanvas;
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
      sandwich: params.sandwich,
      parallax: params.parallax,
      depthMesh: params.depthMesh,
    };

    const depthLayersData = params.imagePath ? this.depthLayerCache.get(params.imagePath) : undefined;
    const particles = params.imagePath ? this.particlesCache.get(params.imagePath) : undefined;
    const dustParticles = params.imagePath ? this.dustParticlesCache.get(params.imagePath) : undefined;

    // Build or retrieve cached baseCanvas (e.g. for wigglegram)
    let baseCanvas: any | undefined;
    if (mode === 'wigglegram' && params.imagePath) {
      baseCanvas = this.baseCanvasCache.get(params.imagePath);
      if (!baseCanvas) {
        const uBaseCanvas = UniversalCanvasProvider.acquireScratchCanvas(width, height);
        baseCanvas = uBaseCanvas.getRawCanvas ? uBaseCanvas.getRawCanvas() : uBaseCanvas;
        const bCtx = baseCanvas.getContext('2d');
        bCtx.drawImage(baseAsset, 0, 0, baseAsset.width, baseAsset.height, 0, 0, width, height);
        this.baseCanvasCache.set(params.imagePath, baseCanvas);
      }
    }

    const renderer = Depth3DFactory.getRenderer(mode);
    if (renderer) {
      renderer.renderFrame(canvasCtx, {
        img: baseAsset,
        subjectImg: cutout?.subjectImg || null,
        subjectBBox: cutout?.subjectBBox || null,
        bgCanvas: bgCanvas || null,
        srcCanvas: depthLayersData?.srcCanvas || null,
        baseCanvas: baseCanvas || null,
        depthLayers: depthLayersData?.depthLayers || null,
        particles,
        dustParticles,
        captions: params.captions,
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

    // Dynamic Relighting Pass (Phase 1)
    if (params.relighting?.enabled && params.imagePath) {
      const normalMap = this.normalMapCache.get(params.imagePath);
      const relightEntry = this.relightCanvasCache.get(params.imagePath);

      if (normalMap && relightEntry) {
        const { canvas: relightCanvas, ctx: rCtx } = relightEntry;

        // Clear pre-allocated scratch canvas
        rCtx.clearRect(0, 0, width, height);

        // Draw current canvas snapshot to scratch canvas
        rCtx.drawImage(canvasCtx.canvas, 0, 0);

        const imgData = rCtx.getImageData(0, 0, width, height);

        // Calculate dynamic light position (interpolated or orbit if needed)
        const lightPos = params.relighting.lightPosition || [
          Math.sin(progress * Math.PI * 2) * 0.8,
          Math.cos(progress * Math.PI * 2) * 0.5 - 0.2,
          1.2,
        ];

        const lightColor = SurfaceNormalGenerator.parseColor(params.relighting.lightColor);

        SurfaceNormalGenerator.applyRelightingToRgba(
          imgData.data,
          normalMap,
          null, // Gated by existing alpha in imgData
          {
            position: lightPos,
            diffuse: params.relighting.diffuse ?? 0.8,
            specular: params.relighting.specular ?? 0.6,
            shininess: params.relighting.shininess ?? 16.0,
            ambient: params.relighting.ambient ?? 0.1,
            rimIntensity: params.relighting.rimIntensity ?? 0.4,
            color: lightColor,
          }
        );

        rCtx.putImageData(imgData, 0, 0);

        // Non-destructive additive screen compositing onto primary canvas context
        canvasCtx.save();
        try {
          canvasCtx.globalCompositeOperation = 'screen';
          canvasCtx.drawImage(relightCanvas, 0, 0);
        } finally {
          canvasCtx.restore();
        }
      }
    }

    // Viewport Pass Inspection & Diagnostics (Composite, Depth Buffer, Surface Normals, Alpha Mask)
    if (ctx.debugMode === 'depth_heatmap' || mode === 'depth_heatmap' || mode === 'depth_map_3d') {
      const depthSrc = depthLayersData?.srcCanvas;
      if (depthSrc) {
        canvasCtx.save();
        try {
          canvasCtx.globalAlpha = 0.95;
          canvasCtx.drawImage(
            depthSrc.getRawCanvas ? depthSrc.getRawCanvas() : depthSrc,
            0,
            0,
            width,
            height
          );
        } finally {
          canvasCtx.restore();
        }
      }
    } else if (ctx.debugMode === 'normals') {
      const normalMap = params.imagePath ? this.normalMapCache.get(params.imagePath) : undefined;
      if (normalMap) {
        canvasCtx.save();
        try {
          const uCanvas = UniversalCanvasProvider.acquireScratchCanvas(width, height);
          const rawScratch = uCanvas.getRawCanvas ? uCanvas.getRawCanvas() : uCanvas;
          const sCtx = rawScratch.getContext('2d');
          const imgData = sCtx.createImageData(width, height);
          const normals = normalMap.normals;
          const totalPixels = width * height;
          for (let i = 0; i < totalPixels; i++) {
            const nIdx = i * 3;
            const pIdx = i * 4;
            // Map [-1, 1] normal vector to RGB [0, 255]
            imgData.data[pIdx] = Math.round((normals[nIdx] * 0.5 + 0.5) * 255);
            imgData.data[pIdx + 1] = Math.round((normals[nIdx + 1] * 0.5 + 0.5) * 255);
            imgData.data[pIdx + 2] = Math.round((normals[nIdx + 2] * 0.5 + 0.5) * 255);
            imgData.data[pIdx + 3] = 255;
          }
          sCtx.putImageData(imgData, 0, 0);
          canvasCtx.drawImage(rawScratch, 0, 0, width, height);
          UniversalCanvasProvider.releaseScratchCanvas(uCanvas);
        } finally {
          canvasCtx.restore();
        }
      }
    } else if (ctx.debugMode === 'alpha') {
      if (cutout?.subjectImg) {
        canvasCtx.save();
        try {
          canvasCtx.clearRect(0, 0, width, height);
          canvasCtx.fillStyle = '#090d16';
          canvasCtx.fillRect(0, 0, width, height);
          canvasCtx.drawImage(
            cutout.subjectImg.getRawCanvas ? cutout.subjectImg.getRawCanvas() : cutout.subjectImg,
            0,
            0,
            width,
            height
          );
        } finally {
          canvasCtx.restore();
        }
      }
    }
  }
}

