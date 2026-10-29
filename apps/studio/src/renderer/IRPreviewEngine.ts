import {
  type ResolvedTimeline,
  type ResolvedSequence,
  type ResolvedTrack,
  IntervalTreeIndex,
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  evaluateSequenceMotion,
  type InterpolatedTransformState,
  IRCanvasCompositor,
  UniversalAudioMixer,
  type AudioMixResult,
  type IAudioSourceProvider,
} from '@acc/ir';
import { NativeResourceManager } from '@acc/core-isomorphic';

import type {
  PreviewWorkerCoordinator,
  ModifierWarmedEvent,
  SidecarPreflightOptions,
} from './PreviewWorkerCoordinator';
import { AssetTextureCache } from '../lib/textures/AssetTextureCache';

export interface IPreviewTextureProvider {
  get(assetId: string): any | undefined;
  has(assetId: string): boolean;
}

export interface PreviewRenderOptions {
  textureCache?: IPreviewTextureProvider | AssetTextureCache;
  lodScale?: number;
  clearColor?: string;
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha';
}

export type EphemeralTransformOverride = Partial<InterpolatedTransformState>;

export interface PreviewFrameResult {
  frame: number;
  timestampSeconds: number;
  activeSequences: ResolvedSequence[];
  renderScale: number;
  latencyMs: number;
}

export interface IRPreviewEngineOptions {
  /** Optional sidecar coordinator. If omitted, engine operates purely without background preflight. */
  sidecarCoordinator?: PreviewWorkerCoordinator | null;
  autoPreflight?: boolean;
}

/**
 * IRPreviewEngine (StudioPreviewEngine):
 * Interactive preview renderer and random-access timeline evaluator in Studio.
 * Adheres strictly to DETERMINISTIC-HANDSHAKE-BACKPRESSURE:
 * - Pure discrete integer frame evaluation: timeSec = frame / fps
 * - Dispatches through ModifierPluginRegistry via IRCanvasCompositor
 * - Integrated StudioSidecarCoordinator for background modifier preflight & warmups
 * - Reactive onModifierWarmed event dispatching for zero-latency UI repaints
 * - Closed-form deterministic motion resolver
 * - Encapsulates UniversalAudioMixer for sample-accurate audio parity with IRMasterRenderer
 */
export class IRPreviewEngine {
  private timeline: ResolvedTimeline;
  private intervalTree: IntervalTreeIndex;
  private currentScale: number = 1.0;
  private pluginRegistry: ModifierPluginRegistry;
  private defaultTextureCache: AssetTextureCache = AssetTextureCache.getInstance();
  private audioMixer: UniversalAudioMixer;
  private audioSourceResolver?: (assetId: string, src?: string) => IAudioSourceProvider | undefined;
  private sidecarCoordinator: PreviewWorkerCoordinator | null = null;
  private autoPreflight: boolean = true;
  private ephemeralTransformOverrides: Map<string, EphemeralTransformOverride> = new Map();

  constructor(
    timeline: ResolvedTimeline,
    pluginRegistry?: ModifierPluginRegistry,
    audioSourceResolver?: (assetId: string, src?: string) => IAudioSourceProvider | undefined,
    audioSampleRate = 48000,
    options?: IRPreviewEngineOptions
  ) {
    this.timeline = timeline;
    const allSequences = Array.from(timeline.sequences.values());
    this.intervalTree = new IntervalTreeIndex(allSequences);
    this.pluginRegistry =
      pluginRegistry ?? registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
    this.audioSourceResolver = audioSourceResolver;
    this.audioMixer = new UniversalAudioMixer([], audioSampleRate);
    this.audioMixer.syncFromTimeline(this.timeline, this.audioSourceResolver);

    this.sidecarCoordinator = options?.sidecarCoordinator ?? null;
    this.autoPreflight = options?.autoPreflight ?? false;

    if (this.autoPreflight && this.sidecarCoordinator) {
      this.sidecarCoordinator.preflightTimeline(this.timeline).catch(() => { });
    }
  }

  /**
   * Synchronizes timeline state across visual interval tree, audio mixer, and sidecar coordinator.
   * Handles sequence additions, modifications, and deletions deterministically.
   */
  public syncTimeline(
    timeline: ResolvedTimeline,
    audioSourceResolver?: (assetId: string, src?: string) => IAudioSourceProvider | undefined
  ): void {
    const previousSequences = this.timeline.sequences;
    this.timeline = timeline;

    // Detect removed sequences and abort in-flight sidecar tasks
    if (this.sidecarCoordinator) {
      for (const [prevId] of previousSequences.entries()) {
        if (!timeline.sequences.has(prevId)) {
          this.sidecarCoordinator.cancelTasksForTarget(prevId);
        }
      }
    }

    const allSequences = Array.from(timeline.sequences.values());
    this.intervalTree = new IntervalTreeIndex(allSequences);
    if (audioSourceResolver !== undefined) {
      this.audioSourceResolver = audioSourceResolver;
    }
    this.audioMixer.syncFromTimeline(this.timeline, this.audioSourceResolver);

    // Eagerly preflight added or updated sequences
    if (this.autoPreflight && this.sidecarCoordinator) {
      this.sidecarCoordinator.preflightTimeline(this.timeline).catch(() => { });
    }
  }

  /**
   * Explicitly triggers preflight execution for all timeline modifiers via sidecar.
   */
  public async prepare(options?: SidecarPreflightOptions): Promise<void> {
    if (this.sidecarCoordinator) {
      await this.sidecarCoordinator.preflightTimeline(this.timeline, options);
    }
  }

  /**
   * Subscribes to modifier warming events to trigger eager canvas frame redraws.
   */
  public onModifierWarmed(callback: (event: ModifierWarmedEvent) => void): () => void {
    if (this.sidecarCoordinator) {
      return this.sidecarCoordinator.onModifierWarmed(callback);
    }
    return () => { };
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
   * Set an ephemeral interactive transform override during active gizmo dragging.
   */
  public setEphemeralTransformOverride(
    sequenceId: string,
    override: EphemeralTransformOverride | null
  ): void {
    if (override === null) {
      this.ephemeralTransformOverrides.delete(sequenceId);
    } else {
      this.ephemeralTransformOverrides.set(sequenceId, override);
    }
  }

  /**
   * Get any active ephemeral transform override for a sequence.
   */
  public getEphemeralTransformOverride(sequenceId: string): EphemeralTransformOverride | undefined {
    return this.ephemeralTransformOverrides.get(sequenceId);
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

    const base = evaluateSequenceMotion(transMod?.params, localSec, durationSec);
    const override = this.ephemeralTransformOverrides.get(sequence.id);
    if (!override) return base;

    return {
      x: override.x !== undefined ? override.x : base.x,
      y: override.y !== undefined ? override.y : base.y,
      scaleX: override.scaleX !== undefined ? override.scaleX : base.scaleX,
      scaleY: override.scaleY !== undefined ? override.scaleY : base.scaleY,
      rotation: override.rotation !== undefined ? override.rotation : base.rotation,
      opacity: override.opacity !== undefined ? override.opacity : base.opacity,
    };
  }

  /**
   * Renders a discrete frame deterministically onto the target CanvasRenderingContext2D.
   * Delegates pure visual layer blitting to canonical IRCanvasCompositor.
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

    const textures = options.textureCache ?? this.defaultTextureCache;
    const activeSequences = this.intervalTree.queryActive(clampedFrame);

    const resourceManager = NativeResourceManager.getInstance();
    const frameScope = resourceManager.createFrameScope(`preview-frame-${clampedFrame}`);

    void IRCanvasCompositor.renderFrame(ctx, this.timeline, clampedFrame, {
      pluginRegistry: this.pluginRegistry,
      assetResolver: textures,
      clearColor: options.clearColor || '#000000',
      debugMode: options.debugMode,
      executionProfile: 'preview',
      frameScope,
      resourceManager,
    }).finally(() => {
      frameScope.dispose();
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

export const StudioPreviewEngine = IRPreviewEngine;
