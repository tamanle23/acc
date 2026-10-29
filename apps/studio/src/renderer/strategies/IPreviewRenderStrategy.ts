import type { ResolvedTimeline, ResolvedSequence } from '@acc/ir';
import type { WorkerRenderOptions } from '../workers/PreviewWorkerBridge';

/**
 * IPreviewRenderStrategy
 *
 * Contract encapsulating render strategies for the Studio Viewport.
 * Decouples high-frequency 60 FPS OffscreenCanvas Web Worker rendering
 * from Main-Thread canvas fallback.
 */
export interface IPreviewRenderStrategy {
  readonly id: 'worker' | 'main-thread';
  readonly isReady: boolean;

  /**
   * Initializes the strategy with the HTMLCanvasElement.
   * If Worker strategy is chosen, transfers control to OffscreenCanvas.
   * Returns true if initialization succeeded.
   */
  init(canvas: HTMLCanvasElement): Promise<boolean> | boolean;

  /**
   * Pushes updated timeline IR topology and assets metadata.
   */
  updateTimeline(
    timeline: ResolvedTimeline,
    totalFrames: number,
    fps: number,
    assets?: Record<string, any>
  ): void;

  /**
   * Synchronizes active visual sequence textures into the renderer context.
   */
  syncTextures(
    activeSeqs: ResolvedSequence[],
    assets: Record<string, any>,
    currentFrame: number,
    fps: number
  ): Promise<void>;

  /**
   * Renders a discrete frame with the given render options.
   */
  renderFrame(frame: number, options?: WorkerRenderOptions): void;

  /**
   * Resizes viewport dimensions.
   */
  resize(width: number, height: number): void;

  /**
   * Optional direct engine access if running on main thread.
   */
  getEngine?(): any;

  /**
   * Subscribes to readiness callbacks.
   */
  onReady(callback: () => void): void;

  /**
   * Disposes of worker threads, canvas contexts, or cached textures.
   */
  dispose(): void;
}
