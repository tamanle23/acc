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
import {
  UniversalCanvasProvider,
  NativeResourceManager,
  type FrameResourceScope,
} from '@acc/core-isomorphic';

export interface IAssetSourceResolver {
  get(assetId: string): any | undefined;
  has(assetId: string): boolean;
  /**
   * Invoked synchronously immediately after ctx.drawImage() completes for a sequence.
   * Enables the resolver to synchronously close transient frames once all sequences in the tick are done.
   */
  onAssetDrawn?(assetId: string, asset: any): void;
}

export interface CanvasCompositorOptions {
  pluginRegistry: ModifierPluginRegistry;
  assetResolver?: IAssetSourceResolver;
  popOutIntensity?: number;
  clearColor?: string;
  generatePixelBuffer?: Uint8Array;
  executionProfile?: 'preview' | 'master';
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha';
  frameScope?: FrameResourceScope;
  resourceManager?: NativeResourceManager;
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

  /**
   * Renders frame t deterministically onto target 2D canvas context.
   * Executes synchronously on the zero-alloc fast-path when all active modifiers are synchronous,
   * while returning a Promise for callers that await completion.
   */
  public static renderFrame(
    canvasCtx: any,
    timeline: ResolvedTimeline,
    frame: number,
    options: CanvasCompositorOptions
  ): Promise<void> {
    const resourceManager = options.resourceManager ?? NativeResourceManager.getInstance();
    const ownsFrameScope = !options.frameScope;
    const frameScope = options.frameScope ?? resourceManager.createFrameScope(`compositor-frame-${frame}`);

    let frameScratchInstance: any | null = null;
    let frameScratchCanvas: any | null = null;
    let frameScratchCtx: any | null = null;

    const getFrameScratchContext = (w: number, h: number): { canvas: any; ctx: any } => {
      if (
        !frameScratchInstance ||
        frameScratchCanvas.width < w ||
        frameScratchCanvas.height < h
      ) {
        if (frameScratchInstance) {
          UniversalCanvasProvider.releaseScratchCanvas(frameScratchInstance);
        }
        frameScratchInstance = UniversalCanvasProvider.acquireScratchCanvas(w, h);
        frameScratchCanvas = frameScratchInstance.getRawCanvas
          ? frameScratchInstance.getRawCanvas()
          : frameScratchInstance;
        frameScratchCtx = frameScratchCanvas.getContext('2d');
      } else if (frameScratchCtx) {
        frameScratchCtx.setTransform(1, 0, 0, 1, 0, 0);
        frameScratchCtx.clearRect(0, 0, frameScratchCanvas.width, frameScratchCanvas.height);
      }
      return {
        canvas: frameScratchCanvas,
        ctx: frameScratchCtx,
      };
    };

    frameScope.onExit(() => {
      if (frameScratchInstance) {
        UniversalCanvasProvider.releaseScratchCanvas(frameScratchInstance);
        frameScratchInstance = null;
        frameScratchCanvas = null;
        frameScratchCtx = null;
      }
    });

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

    const tracksList = Array.from(timeline.tracks.values());
    const visualTracksList = tracksList
      .filter((t) => t.type === 'video' || t.type === 'image' || t.type === 'overlay')
      .sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0));

    const finalizePostVisualTracks = (): void => {
      // 3. Master Canvas Composite Modifiers across visual plates
      for (const track of visualTracksList) {
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

      // 4. Supreme Timed-Text Flat Stack Pass
      // Promotes all timed_text tracks strictly on top of all visual and post-processed layers
      const timedTextTracks = tracksList
        .filter((t) => t.type === 'timed_text')
        .sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0));

      const slotCounters: Record<string, number> = {};

      for (const track of timedTextTracks) {
        if ((track as any).muted === true || (track as any).visible === false || (track.style as any)?.visible === false) {
          continue;
        }

        const trackMod = track.modifiers?.find((m) => m.type === 'timed_text/style' || m.type === 'text/style');
        const trackCaptionSettings: CaptionSettings = {
          ...((track.style as CaptionSettings) || {}),
          ...((trackMod?.params as any) || {}),
        };
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
            const localFrame = clampedFrame - seq.startFrame;

            const textMod = seq.modifiers?.find((m) => m.type === 'timed_text/style' || m.type === 'text/style');
            const textParams = (textMod?.params as any) || {};
            const posKey = textParams.position || trackCaptionSettings.position || 'bottom';
            const currentSlot = slotCounters[posKey] || 0;

            const effectiveSettings: CaptionSettings = {
              ...trackCaptionSettings,
              ...textParams,
              slotIndex: currentSlot,
              fillColor: textParams.fillColor || textParams.textColor || (trackCaptionSettings as any)?.fillColor || (trackCaptionSettings as any)?.textColor,
            };

            const snapshot = IRCanvasCompositor.captionStrategy.evaluate(
              captionConfigs,
              localTimeSec,
              effectiveSettings
            );

            if (snapshot.shouldRender) {
              slotCounters[posKey] = currentSlot + 1;
              canvasCtx.save();

              // Evaluate spatial/motion modifiers on timed_text sequence (e.g. transform, motion/gsap)
              if (seq.modifiers) {
                for (const mod of seq.modifiers) {
                  if (mod.type === 'transform' || mod.type === 'motion/gsap') {
                    const plugin = registry.get(mod.type);
                    if (plugin && plugin.renderClipSpace) {
                      try {
                        plugin.renderClipSpace(
                          {
                            canvas,
                            ctx: canvasCtx,
                            frame: clampedFrame,
                            localFrame,
                            width,
                            height,
                            sequence: seq,
                            baseAsset: undefined,
                            debugMode: options.debugMode,
                          },
                          {
                            ...(popOutIntensity !== undefined ? { popOutIntensity } : {}),
                            ...mod.params,
                          }
                        );
                      } catch (err) {
                        console.warn('Error applying modifier on timed_text:', err);
                      }
                    }
                  }
                }
              }

              drawCanvasCaptionsFromSnapshot(
                canvasCtx,
                snapshot,
                effectiveSettings,
                width,
                height,
                platform
              );

              canvasCtx.restore();
            }
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
    };

    const finishTrackIsolation = (
      track: ResolvedTrack,
      activeTrackSeqs: ResolvedSequence[],
      scratchCanvas: any,
      scratchCtx: any,
      trackBlend: string,
      trackOpacity: number
    ): void => {
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

      canvasCtx.save();
      canvasCtx.globalCompositeOperation = mapBlendModeToCanvasCompositeOperation(trackBlend);
      canvasCtx.globalAlpha = Math.max(0, Math.min(1, trackOpacity));
      if (scratchCanvas.width === width && scratchCanvas.height === height) {
        canvasCtx.drawImage(scratchCanvas, 0, 0, width, height);
      } else {
        canvasCtx.drawImage(scratchCanvas, 0, 0, width, height, 0, 0, width, height);
      }
      canvasCtx.restore();
    };

    const processTracksFrom = (startIndex: number): void | Promise<void> => {
      for (let tIdx = startIndex; tIdx < visualTracksList.length; tIdx++) {
        const track = visualTracksList[tIdx];

        if ((track as any).muted === true || (track as any).visible === false || (track.style as any)?.visible === false) {
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

        const requiresIsolation =
          profile === 'master' ||
          trackBlend !== 'normal' ||
          trackOpacity < 0.999 ||
          hasTrackModifiers;

        if (!requiresIsolation) {
          const seqRes = IRCanvasCompositor.renderTrackSequences(
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
            assets,
            options.debugMode
          );
          if (seqRes instanceof Promise) {
            return seqRes.then(() => processTracksFrom(tIdx + 1));
          }
        } else {
          const { canvas: scratchCanvas, ctx: scratchCtx } = getFrameScratchContext(width, height);
          scratchCtx.save();
          scratchCtx.clearRect(0, 0, width, height);
          scratchCtx.globalAlpha = 1.0;
          scratchCtx.globalCompositeOperation = 'source-over';

          const seqRes = IRCanvasCompositor.renderTrackSequences(
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
          if (seqRes instanceof Promise) {
            return seqRes.then(() => {
              finishTrackIsolation(track, activeTrackSeqs, scratchCanvas, scratchCtx, trackBlend, trackOpacity);
              return processTracksFrom(tIdx + 1);
            });
          }
          finishTrackIsolation(track, activeTrackSeqs, scratchCanvas, scratchCtx, trackBlend, trackOpacity);
        }
      }

      finalizePostVisualTracks();
    };

    try {
      const maybePromise = processTracksFrom(0);
      if (maybePromise instanceof Promise) {
        return maybePromise.finally(() => {
          if (ownsFrameScope) {
            frameScope.dispose();
          }
        });
      }
      if (ownsFrameScope) {
        frameScope.dispose();
      }
      return Promise.resolve();
    } catch (err) {
      if (ownsFrameScope) {
        frameScope.dispose();
      }
      return Promise.reject(err);
    }
  }

  /**
   * Helper to render active sequences within a track into a given 2D context.
   * Executes synchronously when all sequence modifiers are synchronous.
   */
  private static renderTrackSequences(
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
  ): void | Promise<void> {
    const drawBaseAssetAndRestore = (seq: ResolvedSequence): void => {
      try {
        if (ctx.globalAlpha <= 0.001) {
          return;
        }

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

            const isAssetValid = Boolean(
              rawAsset &&
              (rawAsset.width === undefined || rawAsset.width > 0) &&
              (rawAsset.height === undefined || rawAsset.height > 0)
            );

            if (isAssetValid && typeof ctx.drawImage === 'function') {
              try {
                ctx.drawImage(rawAsset, drawX, drawY, drawW, drawH);
              } catch {
                ctx.fillStyle = 'rgba(20, 20, 28, 0.4)';
                ctx.fillRect(0, 0, width, height);
              } finally {
                if (assets?.onAssetDrawn && seq.assetId) {
                  assets.onAssetDrawn(seq.assetId, asset);
                } else if (
                  rawAsset &&
                  (rawAsset as any)._isTransient &&
                  !(rawAsset as any)._isShared &&
                  typeof rawAsset.close === 'function'
                ) {
                  try {
                    rawAsset.close();
                  } catch {}
                }
              }
            } else {
              ctx.fillStyle = 'rgba(20, 20, 28, 0.4)';
              ctx.fillRect(0, 0, width, height);
            }
          } else if (seq.type !== 'overlay' && (!seq.modifiers || seq.modifiers.length === 0)) {
            ctx.fillStyle = 'rgba(20, 20, 28, 0.4)';
            ctx.fillRect(0, 0, width, height);
          }
        } else if (hasDepth3D && !asset) {
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
    };

    const processSeqFrom = (seqIdx: number): void | Promise<void> => {
      for (let i = seqIdx; i < activeTrackSeqs.length; i++) {
        const seq = activeTrackSeqs[i];
        const localFrame = clampedFrame - seq.startFrame;
        ctx.save();

        if (seq.blendMode && seq.blendMode !== 'normal') {
          ctx.globalCompositeOperation = mapBlendModeToCanvasCompositeOperation(seq.blendMode);
        }

        if (seq.modifiers) {
          // Sort clip-space modifiers so spatial transforms and motion apply to canvas matrix before generator/VFX drawing
          const mods = [...seq.modifiers].sort((a, b) => {
            const isATransform = a.type === 'transform' || a.type === 'motion/gsap';
            const isBTransform = b.type === 'transform' || b.type === 'motion/gsap';
            if (isATransform && !isBTransform) return -1;
            if (!isATransform && isBTransform) return 1;
            return 0;
          });
          const runModsFrom = (modIdx: number): void | Promise<void> => {
            for (let m = modIdx; m < mods.length; m++) {
              const mod = mods[m];
              if (mod.target === 'track' || mod.target === 'global') continue;

              const plugin = registry.get(mod.type);
              if (plugin && plugin.renderClipSpace) {
                let res: void | Promise<void>;
                try {
                  res = plugin.renderClipSpace(
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
                } catch (err) {
                  ctx.restore();
                  throw err;
                }
                if (res instanceof Promise) {
                  return res.then(
                    () => runModsFrom(m + 1),
                    (err) => {
                      ctx.restore();
                      throw err;
                    }
                  );
                }
              }
            }
          };

          const modRes = runModsFrom(0);
          if (modRes instanceof Promise) {
            return modRes.then(() => {
              drawBaseAssetAndRestore(seq);
              return processSeqFrom(i + 1);
            });
          }
        }

        drawBaseAssetAndRestore(seq);
      }
    };

    return processSeqFrom(0);
  }
}
