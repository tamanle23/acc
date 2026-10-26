import type { ResolvedTimeline, ResolvedSequence, ResolvedTrack } from '../../types/VideoIR';
import { IntervalTreeIndex } from '../../compiler/IntervalTreeIndex';
import { ModifierPluginRegistry } from '../../plugins/ModifierPluginRegistry';
import { registerCoreModifierPlugins } from '../../plugins';
import { AssetTextureCache } from './AssetTextureCache';
import {
  evaluateSequenceMotion,
  type InterpolatedTransformState,
} from './DeterministicMotionEvaluator';

import { IRCanvasCompositor } from '../shared/IRCanvasCompositor';
import { UniversalAudioMixer, type AudioMixResult } from '../audio/UniversalAudioMixer';
import type { IAudioSourceProvider } from '../audio/AudioSourceAdapter';

export interface IPreviewTextureProvider {
  get(assetId: string): any | undefined;
  has(assetId: string): boolean;
}

export interface PreviewRenderOptions {
  textureCache?: IPreviewTextureProvider | AssetTextureCache;
  popOutIntensity?: number;
  lodScale?: number;
  clearColor?: string;
  debugMode?: 'depth_heatmap' | 'none';
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
 * - Encapsulates UniversalAudioMixer for sample-accurate audio mixing with 100% parity to IRMasterRenderer
 */
export class IRPreviewEngine {
  private timeline: ResolvedTimeline;
  private intervalTree: IntervalTreeIndex;
  private currentScale: number = 1.0;
  private pluginRegistry: ModifierPluginRegistry;
  private defaultTextureCache: AssetTextureCache = new AssetTextureCache();
  private audioMixer: UniversalAudioMixer;
  private audioSourceResolver?: (assetId: string, src?: string) => IAudioSourceProvider | undefined;

  constructor(
    timeline: ResolvedTimeline,
    pluginRegistry?: ModifierPluginRegistry,
    audioSourceResolver?: (assetId: string, src?: string) => IAudioSourceProvider | undefined,
    audioSampleRate = 48000
  ) {
    this.timeline = timeline;
    const allSequences = Array.from(timeline.sequences.values());
    this.intervalTree = new IntervalTreeIndex(allSequences);
    this.pluginRegistry = pluginRegistry ?? registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
    this.audioSourceResolver = audioSourceResolver;
    this.audioMixer = new UniversalAudioMixer([], audioSampleRate);
    this.audioMixer.syncFromTimeline(this.timeline, this.audioSourceResolver);
  }

  /**
   * Synchronizes timeline state across visual interval tree and audio mixer simultaneously.
   */
  public syncTimeline(
    timeline: ResolvedTimeline,
    audioSourceResolver?: (assetId: string, src?: string) => IAudioSourceProvider | undefined
  ): void {
    this.timeline = timeline;
    const allSequences = Array.from(timeline.sequences.values());
    this.intervalTree = new IntervalTreeIndex(allSequences);
    if (audioSourceResolver !== undefined) {
      this.audioSourceResolver = audioSourceResolver;
    }
    this.audioMixer.syncFromTimeline(this.timeline, this.audioSourceResolver);
  }

  /**
   * Retrieves the encapsulated UniversalAudioMixer instance.
   */
  public getAudioMixer(): UniversalAudioMixer {
    return this.audioMixer;
  }

  /**
   * Renders a synchronized audio slice deterministically from the Master Bus.
   */
  public renderAudioSlice(timeSec: number, durationSec: number): AudioMixResult {
    return this.audioMixer.mixStereo(timeSec, durationSec);
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

    IRCanvasCompositor.renderFrame(ctx, this.timeline, clampedFrame, {
      pluginRegistry: this.pluginRegistry,
      assetResolver: textures,
      popOutIntensity,
      clearColor: options.clearColor || '#000000',
      debugMode: options.debugMode,
    });

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
