import type {
  ResolvedTimeline,
  ResolvedTrack,
  ResolvedSequence,
  BlendMode,
} from '../../types/VideoIR';
import type { ModifierPluginRegistry } from '../../plugins/ModifierPluginRegistry';
import {
  BoundedAcousticCaptionStrategy,
  drawCanvasCaptionsFromSnapshot,
  type CaptionConfig,
  type CaptionSettings,
  type SafeZonePlatform,
} from '@acc/effect-engines';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';

export interface IAssetSourceResolver {
  get(assetId: string): any | undefined;
  has(assetId: string): boolean;
}

export interface CanvasCompositorOptions {
  pluginRegistry: ModifierPluginRegistry;
  assetResolver?: IAssetSourceResolver;
  popOutIntensity?: number;
  clearColor?: string;
  generatePixelBuffer?: Uint8Array;
  executionProfile?: 'preview' | 'master';
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha';
}

/**
 * Maps Video IR BlendMode to standard CanvasRenderingContext2D globalCompositeOperation.
 */
export function mapBlendModeToCanvasCompositeOperation(mode?: BlendMode | string): GlobalCompositeOperation {
  switch (mode) {
    case 'screen':
      return 'screen';
    case 'multiply':
      return 'multiply';
    case 'overlay':
      return 'overlay';
    case 'add':
      return 'lighter';
    case 'color_dodge':
      return 'color-dodge';
    case 'soft_light':
      return 'soft-light';
    case 'lighten':
      return 'lighten';
    case 'darken':
      return 'darken';
    case 'difference':
      return 'difference';
    case 'exclusion':
      return 'exclusion';
    case 'normal':
    default:
      return 'source-over';
  }
}

/**
 * IRCanvasCompositor:
 * Canonical, stateless multi-track canvas renderer adhering strictly to:
 * - DETERMINISTIC-HANDSHAKE-BACKPRESSURE: Pure integer frame t evaluation without wall-clock drift.
 * - ZERO-ALLOC-FRAME-LOOP: Reusable weak caches for caption configs, no object churn per frame.
 * - HYBRID-PRAGMATIC-STACKING:
 *     1. Clear Viewport with standardized #000000 background.
 *     2. Visual Tracks (video, image, overlay) in pure document order (0 -> N).
 *     3. Painter's Algorithm with non-destructive scoped isolation (ctx.save/restore).
 *     4. Timed-Text Tracks (subtitles) strictly rendered on top of visual tracks.
 *     5. Master Composite Modifiers across the final aggregate canvas.
 *     6. Explicit Culling via track.muted === true or sequence.enabled === false.
 */
export class IRCanvasCompositor {
  private static captionStrategy = new BoundedAcousticCaptionStrategy();
  private static captionConfigCache = new WeakMap<ResolvedSequence, CaptionConfig[]>();

  // Reusable singleton scratch canvas instances to guarantee ZERO-ALLOC-FRAME-LOOP
  private static scratchCanvasInstance: any | null = null;
  private static scratchCanvas: any | null = null;
  private static scratchCtx: any | null = null;

  private static getScratchContext(width: number, height: number): { canvas: any; ctx: any } {
    if (
      !IRCanvasCompositor.scratchCanvas ||
      IRCanvasCompositor.scratchCanvas.width !== width ||
      IRCanvasCompositor.scratchCanvas.height !== height
    ) {
      IRCanvasCompositor.scratchCanvasInstance = UniversalCanvasProvider.createCanvas(width, height);
      IRCanvasCompositor.scratchCanvas = IRCanvasCompositor.scratchCanvasInstance.getRawCanvas
        ? IRCanvasCompositor.scratchCanvasInstance.getRawCanvas()
        : IRCanvasCompositor.scratchCanvasInstance;
      IRCanvasCompositor.scratchCtx = IRCanvasCompositor.scratchCanvas.getContext('2d');
    }
    return {
      canvas: IRCanvasCompositor.scratchCanvas,
      ctx: IRCanvasCompositor.scratchCtx,
    };
  }

  /**
   * Renders frame t deterministically onto target 2D canvas context.
   */
  public static async renderFrame(
    canvasCtx: any,
    timeline: ResolvedTimeline,
    frame: number,
    options: CanvasCompositorOptions
  ): Promise<void> {
    const totalFrames = timeline.totalFrames;
    const clampedFrame = Math.max(0, Math.min(totalFrames, Math.round(frame)));
    const { w: width, h: height } = timeline.meta.canvasSize;
    const fps = timeline.meta.globalFps || 30;
    const registry = options.pluginRegistry;
    const assets = options.assetResolver;
    const popOutIntensity = options.popOutIntensity;
    const canvas = canvasCtx.canvas || canvasCtx;
    const profile = options.executionProfile || 'preview';

    // 1. Clear Viewport (Standardized background or transparent for checkerboard)
    canvasCtx.save();
    canvasCtx.globalCompositeOperation = 'source-over';
    canvasCtx.globalAlpha = 1.0;
    if (options.clearColor === 'transparent') {
      canvasCtx.clearRect(0, 0, width, height);
    } else {
      canvasCtx.fillStyle = options.clearColor || '#000000';
      canvasCtx.fillRect(0, 0, width, height);
    }
    canvasCtx.restore();

    // 2. Iterate Visual Tracks in NLE Document Order (Track 0 -> Track N: Bottom-to-Top)
    const tracksList = Array.from(timeline.tracks.values());

    for (let tIdx = 0; tIdx < tracksList.length; tIdx++) {
      const track = tracksList[tIdx];

      // Explicit Culling: Skip if muted or explicitly hidden
      if ((track as any).muted === true || (track.style as any)?.visible === false) {
        continue;
      }

      if (track.type !== 'video' && track.type !== 'image' && track.type !== 'overlay') {
        continue;
      }

      const activeTrackSeqs: ResolvedSequence[] = [];
      for (const seq of track.sequences) {
        if ((seq as any).enabled !== false && clampedFrame >= seq.startFrame && clampedFrame < seq.endFrame) {
          activeTrackSeqs.push(seq);
        }
      }

      if (activeTrackSeqs.length === 0) {
        continue;
      }

      const trackBlend = track.blendMode || (track.style as any)?.blendMode || 'normal';
      const trackOpacity = typeof track.opacity === 'number'
        ? track.opacity
        : typeof (track.style as any)?.opacity === 'number'
          ? (track.style as any).opacity
          : 1.0;
      const hasTrackModifiers = Boolean(track.modifiers && track.modifiers.length > 0);

      // Dual-Profile Stacking Decision:
      // In 'master' mode: all visual tracks isolate to guarantee zero filter bleed.
      // In 'preview' mode: fast-path direct draw for clean tracks (blend normal, opacity 1, no track stream mods).
      const requiresIsolation =
        profile === 'master' ||
        trackBlend !== 'normal' ||
        trackOpacity < 0.999 ||
        hasTrackModifiers;

      if (!requiresIsolation) {
        // Fast-path Direct Draw to Master Canvas
        await IRCanvasCompositor.renderTrackSequences(
          canvasCtx,
          canvas,
          track,
          activeTrackSeqs,
          clampedFrame,
          width,
          height,
          fps,
          popOutIntensity,
          registry,
          assets
        );
      } else {
        // Isolated Scratch Compositing Pass
        const { canvas: scratchCanvas, ctx: scratchCtx } = IRCanvasCompositor.getScratchContext(width, height);
        scratchCtx.save();
        scratchCtx.clearRect(0, 0, width, height);
        scratchCtx.globalAlpha = 1.0;
        scratchCtx.globalCompositeOperation = 'source-over';

        // Render sequences inside isolated track buffer
        await IRCanvasCompositor.renderTrackSequences(
          scratchCtx,
          scratchCanvas,
          track,
          activeTrackSeqs,
          clampedFrame,
          width,
          height,
          fps,
          popOutIntensity,
          registry,
          assets,
          options.debugMode
        );

        // Apply Track Stream-Space Modifiers on the scratch buffer
        if (track.modifiers) {
          for (const mod of track.modifiers) {
            const plugin = registry.get(mod.type);
            if (plugin && plugin.renderStreamSpace) {
              plugin.renderStreamSpace(
                {
                  canvas: scratchCanvas,
                  ctx: scratchCtx,
                  frame: clampedFrame,
                  width,
                  height,
                  track,
                  activeSequences: activeTrackSeqs,
                },
                {
                  ...(popOutIntensity !== undefined ? { popOutIntensity } : {}),
                  ...mod.params,
                }
              );
            }
          }
        }
        scratchCtx.restore();

        // Blit scratch track buffer onto master canvas with mapped blend mode and track opacity
        canvasCtx.save();
        canvasCtx.globalCompositeOperation = mapBlendModeToCanvasCompositeOperation(trackBlend);
        canvasCtx.globalAlpha = Math.max(0, Math.min(1, trackOpacity));
        canvasCtx.drawImage(scratchCanvas, 0, 0, width, height);
        canvasCtx.restore();
      }
    }

    // 3. Timed-Text Tracks (Subtitles) Strictly Rendered on Top of Visual Tracks
    for (const track of tracksList) {
      if (track.type !== 'timed_text') continue;

      if ((track as any).muted === true || (track.style as any)?.visible === false) {
        continue;
      }

      const trackCaptionSettings = (track.style as CaptionSettings) || {};
      const platform = (trackCaptionSettings as any)?.platform as SafeZonePlatform | undefined;

      for (const seq of track.sequences) {
        if ((seq as any).enabled === false) continue;

        if (clampedFrame >= seq.startFrame && clampedFrame < seq.endFrame && seq.cues && seq.cues.length > 0) {
          let captionConfigs = IRCanvasCompositor.captionConfigCache.get(seq);
          if (!captionConfigs) {
            captionConfigs = seq.cues.map((c) => ({
              text: c.text,
              start: c.startOffsetMs / 1000,
              end: c.endOffsetMs === 'end' ? (seq.durationFrames / fps) : (c.endOffsetMs / 1000),
            }));
            IRCanvasCompositor.captionConfigCache.set(seq, captionConfigs);
          }

          const localTimeSec = (clampedFrame - seq.startFrame) / fps;

          // Check if sequence has a dedicated 'text/style' modifier
          const textMod = seq.modifiers?.find((m) => m.type === 'text/style');
          const effectiveSettings: CaptionSettings = {
            ...trackCaptionSettings,
            ...(textMod?.params as CaptionSettings || {}),
          };

          const snapshot = IRCanvasCompositor.captionStrategy.evaluate(
            captionConfigs,
            localTimeSec,
            effectiveSettings
          );

          if (snapshot.shouldRender) {
            drawCanvasCaptionsFromSnapshot(
              canvasCtx,
              snapshot,
              effectiveSettings,
              width,
              height,
              platform
            );
          }
        }
      }
    }

    // 4. Master Canvas Composite Modifiers (Phase 4 Master Pass)
    // Track-level master composite
    for (const track of tracksList) {
      if (track.modifiers) {
        for (const mod of track.modifiers) {
          const plugin = registry.get(mod.type);
          if (plugin && plugin.renderMasterComposite) {
            plugin.renderMasterComposite(
              {
                canvas,
                ctx: canvasCtx,
                frame: clampedFrame,
                width,
                height,
                pixelBuffer: options.generatePixelBuffer || new Uint8Array(0),
              },
              {
                ...(popOutIntensity !== undefined ? { popOutIntensity } : {}),
                ...mod.params,
              }
            );
          }
        }
      }
    }

    // Document-level master composite
    if (timeline.modifiers) {
      for (const mod of timeline.modifiers) {
        const plugin = registry.get(mod.type);
        if (plugin && plugin.renderMasterComposite) {
          plugin.renderMasterComposite(
            {
              canvas,
              ctx: canvasCtx,
              frame: clampedFrame,
              width,
              height,
              pixelBuffer: options.generatePixelBuffer || new Uint8Array(0),
            },
            {
              ...(popOutIntensity !== undefined ? { popOutIntensity } : {}),
              ...mod.params,
            }
          );
        }
      }
    }

    // 5. Populate pre-allocated pixel buffer if requested (preserving ZERO-ALLOC-FRAME-LOOP)
    if (options.generatePixelBuffer) {
      if (typeof canvas.data === 'function') {
        options.generatePixelBuffer.set(canvas.data());
      } else if (typeof canvasCtx.getImageData === 'function') {
        const imgData = canvasCtx.getImageData(0, 0, width, height);
        options.generatePixelBuffer.set(imgData.data);
      }
    }
  }

  /**
   * Helper to render active sequences within a track into a given 2D context.
   */
  private static async renderTrackSequences(
    ctx: any,
    canvas: any,
    track: ResolvedTrack,
    activeTrackSeqs: ResolvedSequence[],
    clampedFrame: number,
    width: number,
    height: number,
    fps: number,
    popOutIntensity: number | undefined,
    registry: ModifierPluginRegistry,
    assets?: IAssetSourceResolver,
    debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha'
  ): Promise<void> {
    for (const seq of activeTrackSeqs) {
      const localFrame = clampedFrame - seq.startFrame;
      ctx.save();
      try {
        // Scoped sequence-level blend mode override if specified
        if (seq.blendMode && seq.blendMode !== 'normal') {
          ctx.globalCompositeOperation = mapBlendModeToCanvasCompositeOperation(seq.blendMode);
        }

        // Clip-Space Modifiers (Phase 2): Render sequence-level modifiers (including 'transform')
        if (seq.modifiers) {
          for (const mod of seq.modifiers) {
            if (mod.target === 'track' || mod.target === 'global') continue;

            const plugin = registry.get(mod.type);
            if (plugin && plugin.renderClipSpace) {
              const res = plugin.renderClipSpace(
                {
                  canvas,
                  ctx,
                  frame: clampedFrame,
                  localFrame,
                  width,
                  height,
                  sequence: seq,
                  baseAsset: seq.assetId && assets ? assets.get(seq.assetId) : undefined,
                  debugMode,
                },
                {
                  ...(popOutIntensity !== undefined ? { popOutIntensity } : {}),
                  ...mod.params,
                }
              );
              if (res instanceof Promise) {
                await res;
              }
            }
          }
        }

        // Skip rendering if modifier set opacity to 0
        if (ctx.globalAlpha <= 0.001) {
          continue;
        }

        // Base Asset Blitting (Cover vs Contain) in Universal Top-Left (0, 0) Coordinate Space
        const hasDepth3D = seq.modifiers?.some((m) => m.type === 'vfx/depth3d');
        const asset = seq.assetId && assets?.has(seq.assetId) ? assets.get(seq.assetId) : undefined;

        if (!hasDepth3D && seq.assetId) {
          if (asset) {
            const srcW = asset.width || asset.videoWidth || width;
            const srcH = asset.height || asset.videoHeight || height;
            const fitMode = (seq as any).fitMode || 'cover';

            let drawW = width;
            let drawH = height;

            if (fitMode === 'cover') {
              const scale = Math.max(width / srcW, height / srcH);
              drawW = srcW * scale;
              drawH = srcH * scale;
            } else {
              const scale = Math.min(width / srcW, height / srcH);
              drawW = srcW * scale;
              drawH = srcH * scale;
            }

            const drawX = (width - drawW) * 0.5;
            const drawY = (height - drawH) * 0.5;

            const rawAsset = typeof (asset as any).getRawCanvas === 'function'
              ? (asset as any).getRawCanvas()
              : asset;

            // Defensive check: verify asset is not detached/closed (e.g. ImageBitmap.close() resets width/height to 0)
            const isAssetValid = Boolean(
              rawAsset &&
              (rawAsset.width === undefined || rawAsset.width > 0) &&
              (rawAsset.height === undefined || rawAsset.height > 0)
            );

            if (isAssetValid && typeof ctx.drawImage === 'function') {
              try {
                ctx.drawImage(rawAsset, drawX, drawY, drawW, drawH);
              } catch (drawErr) {
                // Defensive fallback: if the underlying bitmap was detached/closed asynchronously during draw
                ctx.fillStyle = 'rgba(20, 20, 28, 0.4)';
                ctx.fillRect(0, 0, width, height);
              }
            } else {
              ctx.fillStyle = 'rgba(20, 20, 28, 0.4)';
              ctx.fillRect(0, 0, width, height);
            }
          } else if (seq.type !== 'overlay' && (!seq.modifiers || seq.modifiers.length === 0)) {
            // Non-blocking neutral placeholder fallback only if sequence is a primary media clip without procedural modifiers
            ctx.fillStyle = 'rgba(20, 20, 28, 0.4)';
            ctx.fillRect(0, 0, width, height);
          }
        } else if (hasDepth3D && !asset) {
          // Fallback if Depth3D asset has not finished loading/decoding yet
          const rawAsset = typeof (asset as any)?.getRawCanvas === 'function'
            ? (asset as any).getRawCanvas()
            : asset;
          if (!rawAsset && seq.type !== 'overlay') {
            ctx.fillStyle = 'rgba(20, 20, 28, 0.4)';
            ctx.fillRect(0, 0, width, height);
          }
        }
      } finally {
        ctx.restore();
      }
    }
  }
}
