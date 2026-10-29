import {
  UniversalCanvasProvider,
  VisionEngineRegistry,
  DepthStrategyId,
  SegmentationStrategyId,
  Logger,
  ContentCacheRegistry,
  CanvasAssetLoader,
  NativeResourceManager,
} from '@acc/core-isomorphic';
import type { ModifierPlugin, ModifierContext, ClipRenderContext } from '../ModifierPluginRegistry';
import {
  Depth3DFactory,
  drawFrameBreakerFrame,
  SurfaceNormalGenerator,
  type SurfaceNormalMap,
  type RelightingParams,
  resolveSubjectCutout,
  resolveDepthMapData,
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
  depthStrategy?: DepthStrategyId | string;
  segmentationStrategy?: SegmentationStrategyId | string;
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

  public validate(params: unknown): params is Depth3DPluginParams {
    return Boolean(params && typeof params === 'object' && 'mode' in params);
  }

  // Pre-allocated static particle arrays for Zero-Alloc Frame Loop
  private static readonly PARALLAX_PARTICLES = Array.from({ length: 28 }, () => ({
    x: 0,
    y: 0,
    size: 0,
    speedX: 0,
    speedY: 0,
    opacity: 0,
    pulseSpeed: 0,
  }));

  private static readonly DUST_PARTICLES = Array.from({ length: 35 }, () => ({
    x: 0,
    y: 0,
    size: 0,
    speedX: 0,
    speedY: 0,
    opacity: 0,
  }));

  public static cleanupSequence(sequenceIdOrSeq: any): void {
    const id = typeof sequenceIdOrSeq === 'string' ? sequenceIdOrSeq : sequenceIdOrSeq?.id;
    if (id) {
      NativeResourceManager.getInstance().disposeSequenceScope(id);
    }
  }

  public cleanupSequence(sequenceId: string): void {
    Depth3DPlugin.cleanupSequence(sequenceId);
  }

  public async execute(context: ModifierContext, params: Depth3DPluginParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.depth3d = {
      mode: params.mode || 'frame_breaker',
      frameStyle: params.frameStyle,
      popOutIntensity: params.popOutIntensity ?? 1.25,
      depthStrategy: params.depthStrategy || VisionEngineRegistry.getDefaultDepthStrategyId(),
      segmentationStrategy: params.segmentationStrategy || VisionEngineRegistry.getDefaultSegmentationStrategyId(),
      active: true,
    };
    
    // Pre-resolve AI subject cutout and Depth layers isomorphically during preflight into ContentCacheRegistry
    const seq = context.targetType === 'sequence' ? (context.targetEntity as any) : null;
    const seqId = seq?.id || 'default';
    const seqScope = NativeResourceManager.getInstance().getOrCreateSequenceScope(seqId);
    const assetId = seq?.assetId;
    const assetDef = assetId && context.assets ? context.assets[assetId] : undefined;
    const effectiveImagePath = params.imagePath || assetDef?.src || seq?.src || assetId;

    if (effectiveImagePath) {
      const cacheKeys = [effectiveImagePath, params.imagePath, assetId, seq?.id, seq?.src].filter(Boolean) as string[];

      try {
        const cutout = await resolveSubjectCutout(effectiveImagePath, params as any);
        if (cutout) {
          seqScope.setMetadata('cutout_data', cutout);
          if (cutout.subjectImg) {
            NativeResourceManager.getInstance().register('cutout', cutout.subjectImg, { scope: seqScope });
          }
        }
      } catch { }

      const mode = params.mode || 'frame_breaker';
      const width = context.canvas.width;
      const height = context.canvas.height;

      const needsDepth =
        mode === 'depth_map_3d' ||
        mode === 'mesh_displacement' ||
        mode === 'depth_heatmap' ||
        mode === 'parallax_25d' ||
        mode === 'parallax_dolly' ||
        mode === 'volumetric_sandwich' ||
        mode === 'sandwich' ||
        mode === 'frame_breaker' ||
        params.autoDepth !== false ||
        Boolean(params.relighting?.enabled);

      if (needsDepth) {
        try {
          const depthData = await resolveDepthMapData(
            effectiveImagePath,
            width,
            height,
            params as any
          );

          if (depthData) {
            seqScope.setMetadata('depth_data', depthData);
            if (depthData.srcCanvas) {
              NativeResourceManager.getInstance().register('depth_src', depthData.srcCanvas, { scope: seqScope });
            }
          }

          // If relighting is requested, compute surface normal map and persist as Blob in ContentCacheRegistry
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
            seqScope.setMetadata('normal_map', normalMap);
            const normalBlob = new Blob([normalMap.normals.buffer], { type: 'application/octet-stream' });
            for (const k of cacheKeys) {
              await ContentCacheRegistry.get().set(`normal_${k}`, normalBlob, {
                metadata: { width: normalMap.width, height: normalMap.height },
              });
            }
          }
        } catch { }
      }
    }
  }

  /**
   * Phase 2: Clip Space Rendering.
   * Renders the 3D frame border, floating motion, and pop-out effect directly onto the canvas.
   * Adheres strictly to ZERO-ALLOC-FRAME-LOOP:
   * Synchronously reads pre-baked textures from SequenceResourceScope or performs one-time initialization.
   */
  public async renderClipSpace(ctx: ClipRenderContext, params: Depth3DPluginParams): Promise<void> {
    const { ctx: canvasCtx, width, height, localFrame, sequence, baseAsset } = ctx;
    if (!baseAsset) return;
    // Restrict Depth3DPlugin processing exclusively to image sequence types
    if (sequence.type && sequence.type !== 'image') return;

    const seqId = sequence.id || 'default';
    const seqScope = NativeResourceManager.getInstance().getOrCreateSequenceScope(seqId);

    const mode = params.mode || 'frame_breaker';
    const totalSeqFrames = sequence.durationFrames || 1;
    const progress = localFrame / totalSeqFrames;
    const timeSec = localFrame / 30; // Approx 30fps

    const candidateKeys = [
      params.imagePath,
      sequence.assetId,
      sequence.id,
      (sequence as any).src,
    ].filter(Boolean) as string[];

    // Retrieve cached cutout via SequenceResourceScope
    let cutout = seqScope.getMetadata<{ subjectImg: any | null; subjectBBox: any | null }>('cutout_data');
    if (!cutout) {
      const scopedSubject = seqScope.get('cutout')?.getRaw();
      if (scopedSubject) {
        cutout = { subjectImg: scopedSubject, subjectBBox: null };
        seqScope.setMetadata('cutout_data', cutout);
      }
    }
    if (!cutout && candidateKeys[0]) {
      try {
        cutout = await resolveSubjectCutout(candidateKeys[0], params as any);
        if (cutout) {
          seqScope.setMetadata('cutout_data', cutout);
          if (cutout.subjectImg) {
            NativeResourceManager.getInstance().register('cutout', cutout.subjectImg, { scope: seqScope });
          }
        }
      } catch {}
    }
    if (!cutout && (baseAsset as any)._cutoutResolved === undefined) {
      cutout = { subjectImg: null, subjectBBox: null };
    }

    // Build or reuse scoped scratch background plate for frame_breaker
    let bgCanvas: any | undefined;
    if (mode === 'frame_breaker') {
      bgCanvas = seqScope.get('frame_breaker_bg')?.getRaw();
      if (!bgCanvas) {
        try {
          const uBgCanvas = UniversalCanvasProvider.createCanvas(width, height);
          bgCanvas = uBgCanvas.getRawCanvas ? uBgCanvas.getRawCanvas() : uBgCanvas;
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

          NativeResourceManager.getInstance().register('frame_breaker_bg', bgCanvas, { scope: seqScope });
        } catch {}
      }
    }

    const depthConfig = {
      enabled: true,
      mode: mode as any,
      frameStyle: (params.frameStyle || 'polaroid') as any,
      popOutIntensity: params.popOutIntensity ?? 1.25,
      shadow: params.shadow !== false,
      floatMotion: params.floatMotion !== false,
      depthStrategy: params.depthStrategy,
      segmentationStrategy: params.segmentationStrategy,
      sandwich: params.sandwich,
      parallax: params.parallax,
      depthMesh: params.depthMesh,
    };

    const needsDepth =
      mode === 'depth_map_3d' ||
      mode === 'mesh_displacement' ||
      mode === 'depth_heatmap' ||
      mode === 'parallax_25d' ||
      mode === 'parallax_dolly' ||
      mode === 'volumetric_sandwich' ||
      mode === 'sandwich' ||
      mode === 'frame_breaker' ||
      params.autoDepth !== false ||
      Boolean(params.relighting?.enabled);

    let depthLayersData = seqScope.getMetadata<{ srcCanvas: any; depthLayers: any }>('depth_data');
    if (!depthLayersData && needsDepth && candidateKeys[0]) {
      try {
        depthLayersData = await resolveDepthMapData(candidateKeys[0], width, height, params as any);
        if (depthLayersData) {
          seqScope.setMetadata('depth_data', depthLayersData);
          if (depthLayersData.srcCanvas) {
            NativeResourceManager.getInstance().register('depth_src', depthLayersData.srcCanvas, { scope: seqScope });
          }
        }
      } catch {}
    }

    // Zero-alloc in-place mutation of pre-allocated static particles
    let particles: typeof Depth3DPlugin.PARALLAX_PARTICLES | undefined;
    if (mode === 'parallax_25d' || mode === 'parallax_dolly') {
      particles = Depth3DPlugin.PARALLAX_PARTICLES;
      for (let i = 0; i < 28; i++) {
        const p = particles[i];
        p.x = (Math.sin(i * 99 + localFrame * 0.05) * 0.5 + 0.5) * width;
        p.y = (Math.cos(i * 33 + localFrame * 0.03) * 0.5 + 0.5) * height;
        p.size = 3 + (i % 6) * 3;
        p.speedX = (0.4 + (i % 3) * 0.3) * (i % 2 === 0 ? 1 : -1);
        p.speedY = -0.5 - (i % 4) * 0.4;
        p.opacity = 0.2 + (i % 5) * 0.12;
        p.pulseSpeed = 1.5 + (i % 3);
      }
    }

    let dustParticles: typeof Depth3DPlugin.DUST_PARTICLES | undefined;
    if (mode === 'volumetric_sandwich' || mode === 'sandwich') {
      dustParticles = Depth3DPlugin.DUST_PARTICLES;
      for (let i = 0; i < 35; i++) {
        const p = dustParticles[i];
        p.x = (Math.sin(i * 47 + localFrame * 0.02) * 0.5 + 0.5) * width;
        p.y = (Math.cos(i * 83 + localFrame * 0.015) * 0.5 + 0.5) * height;
        p.size = 2 + (i % 4) * 2;
        p.speedX = (0.2 + (i % 3) * 0.2) * (i % 2 === 0 ? 1 : -1);
        p.speedY = -0.3 - (i % 3) * 0.2;
        p.opacity = 0.15 + (i % 4) * 0.1;
      }
    }

    let baseCanvas: any | undefined;
    if (mode === 'wigglegram') {
      baseCanvas = seqScope.get('wiggle_base')?.getRaw();
      if (!baseCanvas) {
        try {
          const uBaseCanvas = UniversalCanvasProvider.createCanvas(width, height);
          baseCanvas = uBaseCanvas.getRawCanvas ? uBaseCanvas.getRawCanvas() : uBaseCanvas;
          const bCtx = baseCanvas.getContext('2d');
          bCtx.drawImage(baseAsset, 0, 0, baseAsset.width, baseAsset.height, 0, 0, width, height);
          NativeResourceManager.getInstance().register('wiggle_base', baseCanvas, { scope: seqScope });
        } catch {}
      }
    }

    try {
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
      if (params.relighting?.enabled) {
        let normalMap = seqScope.getMetadata<SurfaceNormalMap>('normal_map');
        if (!normalMap) {
          for (const k of candidateKeys) {
            const normalKey = `normal_${k}`;
            if (await ContentCacheRegistry.get().has(normalKey)) {
              const blob = await ContentCacheRegistry.get().get(normalKey);
              if (blob) {
                const meta = await ContentCacheRegistry.get().getMetadata(normalKey);
                const ab = await blob.arrayBuffer();
                normalMap = {
                  normals: new Float32Array(ab),
                  width: (meta?.metadata?.width as number) || width,
                  height: (meta?.metadata?.height as number) || height,
                };
                seqScope.setMetadata('normal_map', normalMap);
                break;
              }
            }
          }
        }

        if (normalMap) {
          const uRelightCanvas = UniversalCanvasProvider.acquireScratchCanvas(width, height);
          const relightCanvas = uRelightCanvas.getRawCanvas ? uRelightCanvas.getRawCanvas() : uRelightCanvas;
          const rCtx = relightCanvas.getContext('2d');

          try {
            rCtx.clearRect(0, 0, width, height);
            rCtx.drawImage(canvasCtx.canvas, 0, 0);
            const imgData = rCtx.getImageData(0, 0, width, height);

            const lightPos = params.relighting.lightPosition || [
              Math.sin(progress * Math.PI * 2) * 0.8,
              Math.cos(progress * Math.PI * 2) * 0.5 - 0.2,
              1.2,
            ];

            const lightColor = SurfaceNormalGenerator.parseColor(params.relighting.lightColor);

            SurfaceNormalGenerator.applyRelightingToRgba(
              imgData.data,
              normalMap,
              null,
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

            canvasCtx.save();
            try {
              canvasCtx.globalCompositeOperation = 'screen';
              canvasCtx.drawImage(relightCanvas, 0, 0);
            } finally {
              canvasCtx.restore();
            }
          } finally {
            UniversalCanvasProvider.releaseScratchCanvas(uRelightCanvas);
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
        let normalMap = seqScope.getMetadata<SurfaceNormalMap>('normal_map');
        if (!normalMap) {
          for (const k of candidateKeys) {
            const normalKey = `normal_${k}`;
            if (await ContentCacheRegistry.get().has(normalKey)) {
              const blob = await ContentCacheRegistry.get().get(normalKey);
              if (blob) {
                const meta = await ContentCacheRegistry.get().getMetadata(normalKey);
                const ab = await blob.arrayBuffer();
                normalMap = {
                  normals: new Float32Array(ab),
                  width: (meta?.metadata?.width as number) || width,
                  height: (meta?.metadata?.height as number) || height,
                };
                seqScope.setMetadata('normal_map', normalMap);
                break;
              }
            }
          }
        }
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
    } finally {
      // Sequence resources are managed via SequenceResourceScope
    }
  }
}

