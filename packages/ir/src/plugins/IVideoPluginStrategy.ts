import type { ResolvedTrack, ResolvedSequence, ModifierNode } from '../types/VideoIR';

export type PluginTargetPhase = 1 | 2 | 3 | 4;

export interface DAGResolutionContext {
  fps: number;
  canvas: { width: number; height: number };
  assets: ReadonlyMap<string, unknown>;
  timeline: ReadonlyMap<string, ResolvedSequence>;
}

export interface ClipRenderContext {
  canvas: any; // NAPI-RS or HTML5 Canvas
  ctx: any;    // 2D Rendering Context
  frame: number;
  localFrame: number;
  width: number;
  height: number;
  sequence: ResolvedSequence;
  baseAsset?: any;
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha';
}

export interface StreamRenderContext {
  canvas: any;
  ctx: any;
  frame: number;
  width: number;
  height: number;
  track: ResolvedTrack;
  activeSequences: ResolvedSequence[];
}

export interface MasterCompositeContext {
  canvas: any;
  ctx: any;
  frame: number;
  width: number;
  height: number;
  pixelBuffer: Uint8Array;
}

export interface AudioProcessContext {
  sampleRate: number;
  channels: number;
  frame: number;
  totalFrames: number;
}

/**
 * IVideoPluginStrategy:
 * 4-Phase Lifecycle Strategy Contract adhering to Document 7:
 * - Phase 1: Pre-flight & Relational DAG Resolution (Static analysis, bounding boxes)
 * - Phase 2: Sequence-Level Execution (Clip Space $t \in [0, duration]$)
 * - Phase 3: Track-Level Execution (Stream Space across concatenated track)
 * - Phase 4: Master Canvas Compositing & Handshake (Multi-track layering, blend modes, audio DSP)
 */
export interface IVideoPluginStrategy<TParams = Record<string, unknown>, TState = any> {
  readonly pluginId: string;
  readonly targetPhase: PluginTargetPhase;
  readonly targetScope: 'track' | 'sequence' | 'master' | 'audio' | 'both';

  validate?(params: unknown): params is TParams;

  /**
   * PHASE 1: Pre-flight. Resolve expressions, bounding boxes, or physics setups.
   * Returns an immutable state object passed to subsequent rendering phases.
   */
  preflight?(params: TParams, dagContext: DAGResolutionContext): TState;

  /**
   * PHASE 2: Local Clip Space. Render into the isolated sequence surface buffer.
   */
  renderClipSpace?(ctx: ClipRenderContext, params: TParams, state?: TState): void | Promise<void>;

  /**
   * PHASE 3: Stream Space. Render across the continuous track buffer.
   */
  renderStreamSpace?(ctx: StreamRenderContext, params: TParams, state?: TState): void | Promise<void>;

  /**
   * PHASE 4: Master Composite. Modify final outgoing multi-track canvas before hardware handshake.
   */
  renderMasterComposite?(ctx: MasterCompositeContext, params: TParams, state?: TState): void | Promise<void>;

  /**
   * AUDIO PROCESSING: Real-time or batch DSP stream modulation.
   */
  processAudioStream?(ctx: AudioProcessContext, buffer: Float32Array, params: TParams, state?: TState): void | Promise<void>;
}
