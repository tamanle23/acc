import type { ResolvedTimeline, ResolvedSequence, ResolvedTrack } from '../../types/VideoIR';
import { IntervalTreeIndex } from '../../compiler/IntervalTreeIndex';
import { ModifierPluginRegistry } from '../../plugins/ModifierPluginRegistry';
import { registerClientModifierPlugins } from '../../plugins/clientRegistry';
import { AssetTextureCache } from './AssetTextureCache';
import {
  evaluateSequenceMotion,
  type InterpolatedTransformState,
} from './DeterministicMotionEvaluator';

export interface IPreviewTextureProvider {
  get(assetId: string): any | undefined;
  has(assetId: string): boolean;
}

export interface PreviewRenderOptions {
  textureCache?: IPreviewTextureProvider | AssetTextureCache;
  popOutIntensity?: number;
  lodScale?: number;
}

export interface PreviewFrameResult {
  frame: number;
  timestampSeconds: number;
  activeSequences: ResolvedSequence[];
  renderScale: number;
  latencyMs: number;
}

/**
 * IRPreviewEngine:
 * Full interactive renderer and random-access timeline evaluator mirroring IRMasterRenderer.
 * Adheres strictly to DETERMINISTIC-HANDSHAKE-BACKPRESSURE:
 * - Pure discrete integer frame evaluation: timeSec = frame / fps
 * - Dispatches through ModifierPluginRegistry for clip-space, stream-space, and master-composite modifiers
 * - Multi-track visual layer composition with track sorting, aspect-ratio fit modes, and blend modes
 * - Closed-form deterministic motion resolver (pop_in, slide_left, bounce, overshoot, drift)
 * - Retains seek() for interval tree queries & LOD scale
 */
export class IRPreviewEngine {
  private timeline: ResolvedTimeline;
  private intervalTree: IntervalTreeIndex;
  private currentScale: number = 1.0;
  private pluginRegistry: ModifierPluginRegistry;
  private defaultTextureCache: AssetTextureCache = new AssetTextureCache();

  constructor(timeline: ResolvedTimeline, pluginRegistry?: ModifierPluginRegistry) {
    this.timeline = timeline;
    const allSequences = Array.from(timeline.sequences.values());
    this.intervalTree = new IntervalTreeIndex(allSequences);
    this.pluginRegistry = pluginRegistry ?? registerClientModifierPlugins(ModifierPluginRegistry.createIsolated());
  }

  /**
   * Set Level of Detail (LOD) for responsive scrubbing (e.g. 0.25x or 0.5x)
   */
  public setLODScale(scale: number): void {
    this.currentScale = Math.max(0.1, Math.min(1.0, scale));
  }

  /**
   * Retrieve current LOD scale factor.
   */
  public getLODScale(): number {
    return this.currentScale;
  }

  /**
   * Retrieve active texture cache instance.
   */
  public getTextureCache(): AssetTextureCache {
    return this.defaultTextureCache;
  }

  /**
   * Random-access seek to arbitrary frame integer t.
   * Target latency: < 16ms (60 FPS interactive).
   */
  public seek(frame: number): PreviewFrameResult {
    const start = performance.now();
    const clampedFrame = Math.max(0, Math.min(this.timeline.totalFrames, Math.round(frame)));
    const activeSequences = this.intervalTree.queryActive(clampedFrame);
    const latencyMs = performance.now() - start;

    return {
      frame: clampedFrame,
      timestampSeconds: clampedFrame / this.timeline.meta.globalFps,
      activeSequences,
      renderScale: this.currentScale,
      latencyMs,
    };
  }

  /**
   * Evaluates deterministic interpolated transform state for a sequence.
   */
  public getActiveInterpolatedTransform(
    sequence: ResolvedSequence,
    frame: number
  ): InterpolatedTransformState {
    const fps = this.timeline.meta.globalFps;
    const localSec = Math.max(0, (frame - sequence.startFrame) / fps);
    const durationSec = Math.max(0.01, sequence.durationFrames / fps);
    const transMod = sequence.modifiers?.find((m) => m.type === 'transform');

    return evaluateSequenceMotion(transMod?.params, localSec, durationSec);
  }

  /**
   * Renders a discrete frame deterministically onto the target CanvasRenderingContext2D.
   * Mirrors IRMasterRenderer's 4-phase lifecycle:
   * 1. Clear background
   * 2. Track order sorting (V1 -> V4)
   * 3. Sequence Clip-Space Modifiers & Visual Blitting
   * 4. Track Stream-Space Modifiers
   * 5. Master Composite Modifiers
   */
  public renderFrame(
    frame: number,
    ctx: CanvasRenderingContext2D,
    options: PreviewRenderOptions = {}
  ): PreviewFrameResult {
    const start = performance.now();
    const totalFrames = this.timeline.totalFrames;
    const clampedFrame = Math.max(0, Math.min(totalFrames, Math.round(frame)));
    const fps = this.timeline.meta.globalFps;
    const timeSec = clampedFrame / fps;

    const { w: width, h: height } = this.timeline.meta.canvasSize;
    const textures = options.textureCache ?? this.defaultTextureCache;
    const popOutIntensity = options.popOutIntensity ?? 1.0;
    const activeSequences = this.intervalTree.queryActive(clampedFrame);

    ctx.save();

    // 1. Clear Viewport
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // 2. Track Order Sorting (Sort video & visual tracks)
    const sortedTracks = Array.from(this.timeline.tracks.values()).sort((a, b) => {
      const idxA = (a.style as any)?.trackIndex ?? 0;
      const idxB = (b.style as any)?.trackIndex ?? 0;
      return idxA - idxB;
    });

    for (const track of sortedTracks) {
      if (track.type !== 'video' && track.type !== 'image' && track.type !== 'overlay') {
        continue;
      }

      const activeTrackSeqs: ResolvedSequence[] = [];

      for (const seq of track.sequences) {
        if (clampedFrame >= seq.startFrame && clampedFrame < seq.endFrame) {
          activeTrackSeqs.push(seq);
          const localFrame = clampedFrame - seq.startFrame;

          ctx.save();
          try {
            // Apply blend mode if specified
            const blend = seq.blendMode || (track.style as any)?.blendMode;
            if (blend === 'screen') ctx.globalCompositeOperation = 'screen';
            else if (blend === 'multiply') ctx.globalCompositeOperation = 'multiply';
            else if (blend === 'overlay') ctx.globalCompositeOperation = 'overlay';
            else if (blend === 'add') ctx.globalCompositeOperation = 'lighter';
            else if (blend === 'normal') ctx.globalCompositeOperation = 'source-over';

            // Evaluate motion / transform
            const motion = this.getActiveInterpolatedTransform(seq, clampedFrame);
            if (motion.opacity <= 0.001) {
              continue;
            }

            // Stack viewport matrix
            ctx.translate(width * 0.5 + motion.x, height * 0.5 + motion.y);
            if (motion.rotation !== 0) {
              ctx.rotate((motion.rotation * Math.PI) / 180);
            }
            if (motion.scale !== 1.0) {
              ctx.scale(motion.scale, motion.scale);
            }
            ctx.globalAlpha = Math.max(0, Math.min(1, motion.opacity));

            // Clip-Space Modifiers
            if (seq.modifiers) {
              for (const mod of seq.modifiers) {
                const plugin = this.pluginRegistry.get(mod.type);
                if (plugin && plugin.renderClipSpace) {
                  plugin.renderClipSpace(
                    {
                      canvas: ctx.canvas,
                      ctx,
                      frame: clampedFrame,
                      localFrame,
                      width,
                      height,
                      sequence: seq,
                      baseAsset: seq.assetId ? textures.get(seq.assetId) : undefined,
                    },
                    {
                      ...mod.params,
                      popOutIntensity,
                    }
                  );
                }
              }
            }

            // Base Asset Blitting
            const hasDepth3D = seq.modifiers?.some((m) => m.type === 'vfx/depth3d');
            if (!hasDepth3D && seq.assetId && textures.has(seq.assetId)) {
              const asset = textures.get(seq.assetId);
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

              const drawX = -drawW * 0.5;
              const drawY = -drawH * 0.5;

              if (typeof ctx.drawImage === 'function') {
                ctx.drawImage(asset, drawX, drawY, drawW, drawH);
              }
            }
          } finally {
            ctx.restore();
          }
        }
      }

      // Track Stream-Space Modifiers (Phase 3)
      if (track.modifiers) {
        for (const mod of track.modifiers) {
          const plugin = this.pluginRegistry.get(mod.type);
          if (plugin && plugin.renderStreamSpace) {
            plugin.renderStreamSpace(
              {
                canvas: ctx.canvas,
                ctx,
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

    // Phase 4: Master Canvas Composite Modifiers
    for (const track of this.timeline.tracks.values()) {
      if (track.modifiers) {
        for (const mod of track.modifiers) {
          const plugin = this.pluginRegistry.get(mod.type);
          if (plugin && plugin.renderMasterComposite) {
            plugin.renderMasterComposite(
              {
                canvas: ctx.canvas,
                ctx,
                frame: clampedFrame,
                width,
                height,
                pixelBuffer: new Uint8Array(0),
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

    // Global Document-Level Master Composite Modifiers
    if (this.timeline.modifiers) {
      for (const mod of this.timeline.modifiers) {
        const plugin = this.pluginRegistry.get(mod.type);
        if (plugin && plugin.renderMasterComposite) {
          plugin.renderMasterComposite(
            {
              canvas: ctx.canvas,
              ctx,
              frame: clampedFrame,
              width,
              height,
              pixelBuffer: new Uint8Array(0),
            },
            {
              ...mod.params,
              popOutIntensity,
            }
          );
        }
      }
    }

    ctx.restore();

    const latencyMs = performance.now() - start;

    return {
      frame: clampedFrame,
      timestampSeconds: timeSec,
      activeSequences,
      renderScale: this.currentScale,
      latencyMs,
    };
  }
}
