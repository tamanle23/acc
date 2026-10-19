import type {
  ResolvedTimeline,
  ResolvedTrack,
  ResolvedSequence,
} from '../../types/VideoIR';
import type { ModifierPluginRegistry } from '../../plugins/ModifierPluginRegistry';
import {
  BoundedAcousticCaptionStrategy,
  drawCanvasCaptionsFromSnapshot,
  type CaptionConfig,
  type CaptionSettings,
  type SafeZonePlatform,
} from '@acc/effect-engines/client';

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
   */
  public static renderFrame(
    canvasCtx: any,
    timeline: ResolvedTimeline,
    frame: number,
    options: CanvasCompositorOptions
  ): void {
    const totalFrames = timeline.totalFrames;
    const clampedFrame = Math.max(0, Math.min(totalFrames, Math.round(frame)));
    const { w: width, h: height } = timeline.meta.canvasSize;
    const fps = timeline.meta.globalFps || 30;
    const registry = options.pluginRegistry;
    const assets = options.assetResolver;
    const popOutIntensity = options.popOutIntensity ?? 1.0;
    const canvas = canvasCtx.canvas || canvasCtx;

    // 1. Clear Viewport (Standardized Pure Black #000000)
    canvasCtx.save();
    canvasCtx.globalCompositeOperation = 'source-over';
    canvasCtx.globalAlpha = 1.0;
    canvasCtx.fillStyle = options.clearColor || '#000000';
    canvasCtx.fillRect(0, 0, width, height);
    canvasCtx.restore();

    // 2. Iterate Visual Tracks in Pure Document Order (Track 0 -> Track N)
    const tracksList = Array.from(timeline.tracks.values());

    for (const track of tracksList) {
      // Explicit Culling: Skip if muted or explicitly hidden
      if ((track as any).muted === true || (track.style as any)?.visible === false) {
        continue;
      }

      if (track.type !== 'video' && track.type !== 'image' && track.type !== 'overlay') {
        continue;
      }

      const activeTrackSeqs: ResolvedSequence[] = [];

      for (const seq of track.sequences) {
        // Explicit Culling: Skip if sequence explicitly disabled
        if ((seq as any).enabled === false) {
          continue;
        }

        if (clampedFrame >= seq.startFrame && clampedFrame < seq.endFrame) {
          activeTrackSeqs.push(seq);
          const localFrame = clampedFrame - seq.startFrame;
          const localSec = Math.max(0, localFrame / fps);
          const durationSec = Math.max(0.01, (seq.durationFrames || 1) / fps);

          canvasCtx.save();
          try {
            // Apply scoped blend mode
            const blend = seq.blendMode || (track.style as any)?.blendMode || track.blendMode;
            if (blend === 'screen') canvasCtx.globalCompositeOperation = 'screen';
            else if (blend === 'multiply') canvasCtx.globalCompositeOperation = 'multiply';
            else if (blend === 'overlay') canvasCtx.globalCompositeOperation = 'overlay';
            else if (blend === 'add') canvasCtx.globalCompositeOperation = 'lighter';
            else if (blend === 'normal') canvasCtx.globalCompositeOperation = 'source-over';

            // Clip-Space Modifiers (Phase 2): Render sequence-level modifiers (including 'transform')
            if (seq.modifiers) {
              for (const mod of seq.modifiers) {
                if (mod.target === 'track' || mod.target === 'global') continue;

                const plugin = registry.get(mod.type);
                if (plugin && plugin.renderClipSpace) {
                  plugin.renderClipSpace(
                    {
                      canvas,
                      ctx: canvasCtx,
                      frame: clampedFrame,
                      localFrame,
                      width,
                      height,
                      sequence: seq,
                      baseAsset: seq.assetId && assets ? assets.get(seq.assetId) : undefined,
                    },
                    {
                      ...mod.params,
                      popOutIntensity,
                    }
                  );
                }
              }
            }

            // Skip rendering if modifier set opacity to 0
            if (canvasCtx.globalAlpha <= 0.001) {
              continue;
            }

            // Base Asset Blitting (Cover vs Contain) in Universal Top-Left (0, 0) Coordinate Space
            const hasDepth3D = seq.modifiers?.some((m) => m.type === 'vfx/depth3d');
            if (!hasDepth3D && seq.assetId) {
              const asset = assets?.has(seq.assetId) ? assets.get(seq.assetId) : undefined;

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

                if (rawAsset && typeof canvasCtx.drawImage === 'function') {
                  canvasCtx.drawImage(rawAsset, drawX, drawY, drawW, drawH);
                }
              } else {
                // Non-blocking neutral placeholder fallback in standard top-left space
                canvasCtx.fillStyle = 'rgba(20, 20, 28, 0.4)';
                canvasCtx.fillRect(0, 0, width, height);
              }
            }
          } finally {
            canvasCtx.restore();
          }
        }
      }

      // Track Stream-Space Modifiers (Phase 3)
      if (track.modifiers) {
        for (const mod of track.modifiers) {
          const plugin = registry.get(mod.type);
          if (plugin && plugin.renderStreamSpace) {
            plugin.renderStreamSpace(
              {
                canvas,
                ctx: canvasCtx,
                frame: clampedFrame,
                width,
                height,
                track,
                activeSequences: activeTrackSeqs,
              },
              {
                ...mod.params,
                popOutIntensity,
              }
            );
          }
        }
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
                ...mod.params,
                popOutIntensity,
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
              ...mod.params,
              popOutIntensity,
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
}
