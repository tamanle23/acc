import type { ResolvedTimeline } from '@acc/ir';
import { DeterministicTimelineClock } from '@acc/core-isomorphic';
import { CanvasTransferTracker } from '@acc/core-web';

export interface WorkerRenderOptions {
  lod?: number;
  isScrubbing?: boolean;
  isPlaying?: boolean;
  clearColor?: string;
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha';
}

export interface InitMessage {
  type: 'INIT';
  canvas?: any; // OffscreenCanvas
  width: number;
  height: number;
  fps: number;
  irDoc?: any;
}

export interface DispatchFrameMessage {
  type: 'DISPATCH_FRAME';
  frame: number;
  speed?: number;
  lod?: number;
}

export interface UpdateTimelineMessage {
  type: 'UPDATE_TIMELINE';
  irDoc: any;
}

export interface ResizeMessage {
  type: 'RESIZE';
  width: number;
  height: number;
}

export type WorkerMessage =
  | InitMessage
  | DispatchFrameMessage
  | UpdateTimelineMessage
  | ResizeMessage;

export interface FrameAckPayload {
  type: 'FRAME_ACK';
  frame: number;
  lod: number;
  timestamp: number;
  cached?: boolean;
}

/**
 * LRU Frame Ring Buffer maintaining 120 forward / 30 backward decoded frames.
 */
export class DecodedFrameCache {
  private cache: Map<number, ImageData | any> = new Map();
  private maxForward: number;
  private maxBackward: number;

  constructor(maxForward: number = 120, maxBackward: number = 30) {
    this.maxForward = maxForward;
    this.maxBackward = maxBackward;
  }

  public get(frame: number): ImageData | any | undefined {
    return this.cache.get(frame);
  }

  public set(frame: number, data: ImageData | any): void {
    this.cache.set(frame, data);
    this.prune(frame);
  }

  public has(frame: number): boolean {
    return this.cache.has(frame);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  private prune(currentFrame: number): void {
    const totalMax = this.maxForward + this.maxBackward;
    if (this.cache.size <= totalMax) return;

    for (const cachedFrame of this.cache.keys()) {
      if (
        cachedFrame < currentFrame - this.maxBackward ||
        cachedFrame > currentFrame + this.maxForward
      ) {
        this.cache.delete(cachedFrame);
      }
    }
  }
}

/**
 * PreviewRenderWorkerCore:
 * Synchronous protocol handler and ring-buffer evaluator for OffscreenCanvas worker tests
 * and deterministic frame acknowledgments.
 */
export class PreviewRenderWorkerCore {
  private canvas: any | null = null;
  private ctx: any | null = null;
  private width: number = 1920;
  private height: number = 1080;
  private fps: number = 30;
  private irDoc: any | null = null;
  private frameCache: DecodedFrameCache = new DecodedFrameCache(120, 30);
  private lastRenderedFrame: number = -1;
  private clock: DeterministicTimelineClock = new DeterministicTimelineClock({ fps: 30 });

  public getClock(): DeterministicTimelineClock {
    return this.clock;
  }

  public handleMessage(
    msg: WorkerMessage,
    postMessage: (data: FrameAckPayload) => void
  ): void {
    switch (msg.type) {
      case 'INIT': {
        this.canvas = msg.canvas;
        this.width = msg.width || 1920;
        this.height = msg.height || 1080;
        this.fps = msg.fps || 30;
        this.irDoc = msg.irDoc || null;
        this.clock.setFps(this.fps);
        if (this.canvas && typeof this.canvas.getContext === 'function') {
          this.ctx = this.canvas.getContext('2d');
        }
        break;
      }

      case 'RESIZE': {
        this.width = msg.width;
        this.height = msg.height;
        if (this.canvas) {
          this.canvas.width = msg.width;
          this.canvas.height = msg.height;
        }
        this.frameCache.clear();
        break;
      }

      case 'UPDATE_TIMELINE': {
        this.irDoc = msg.irDoc;
        if (msg.irDoc?.timeline?.totalFrames) {
          this.clock.setTotalFrames(msg.irDoc.timeline.totalFrames);
        }
        this.frameCache.clear();
        break;
      }

      case 'DISPATCH_FRAME': {
        const frame = this.clock.seek(msg.frame);
        const speed = msg.speed ?? 1.0;
        const lod = msg.lod ?? (Math.abs(speed) > 3.0 ? 0.5 : 1.0);

        const isCached = this.frameCache.has(frame);
        if (isCached && this.ctx) {
          const cached = this.frameCache.get(frame);
          if (cached && typeof this.ctx.putImageData === 'function') {
            try {
              this.ctx.putImageData(cached, 0, 0);
            } catch {
              // Ignore canvas putImageData errors in headless environments
            }
          }
        } else if (this.ctx) {
          this.renderToContext(this.ctx, frame, lod);
          if (typeof this.ctx.getImageData === 'function') {
            try {
              const imgData = this.ctx.getImageData(
                0,
                0,
                Math.min(100, this.width),
                Math.min(100, this.height)
              );
              this.frameCache.set(frame, imgData);
            } catch {
              // Ignore in headless environments without full DOM ImageData
            }
          }
        }

        this.lastRenderedFrame = frame;

        postMessage({
          type: 'FRAME_ACK',
          frame,
          lod,
          timestamp: frame / Math.max(1, this.fps),
          cached: isCached,
        });
        break;
      }
    }
  }

  public getCache(): DecodedFrameCache {
    return this.frameCache;
  }

  public getLastRenderedFrame(): number {
    return this.lastRenderedFrame;
  }

  private renderToContext(ctx: any, frame: number, _lod: number): void {
    if (!ctx) return;
    ctx.save?.();
    if (ctx.clearRect) ctx.clearRect(0, 0, this.width, this.height);
    if (ctx.fillStyle !== undefined) ctx.fillStyle = '#0a0a0a';
    if (ctx.fillRect) ctx.fillRect(0, 0, this.width, this.height);

    if (ctx.fillStyle !== undefined) ctx.fillStyle = '#00ffff';
    if (ctx.fillRect) ctx.fillRect(0, 0, (frame % 100) * 5, 4);

    ctx.restore?.();
  }
}

export class PreviewWorkerBridge implements Disposable {
  private worker: Worker | null = null;
  private isSupported: boolean = false;
  private isTransferred: boolean = false;
  private isReady: boolean = false;
  private isPlaying: boolean = false;
  private onFrameUpdateCallback: ((frame: number, ended?: boolean) => void) | null = null;
  private onFrameRenderedCallback: ((frame: number, latencyMs: number) => void) | null = null;
  private onReadyCallback: (() => void) | null = null;

  public onFrameRendered(callback: (frame: number, latencyMs: number) => void): () => void {
    this.onFrameRenderedCallback = callback;
    return () => {
      if (this.onFrameRenderedCallback === callback) {
        this.onFrameRenderedCallback = null;
      }
    };
  }

  constructor() {
    this.isSupported =
      typeof window !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function' &&
      typeof Worker !== 'undefined';
  }

  public supportsOffscreen(): boolean {
    return this.isSupported;
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  public onReady(callback: () => void): void {
    if (this.isReady) {
      callback();
    } else {
      this.onReadyCallback = callback;
    }
  }

  public hasTransferred(): boolean {
    return this.isTransferred;
  }

  public init(
    canvas: HTMLCanvasElement,
    timeline: ResolvedTimeline,
    width: number,
    height: number,
    fps: number,
    totalFrames: number,
    assets?: Record<string, { src?: string; type?: string }>
  ): boolean {
    if (!this.isSupported) return false;
    if (this.isTransferred || CanvasTransferTracker.isTransferred(canvas)) return true;

    try {
      const offscreen = canvas.transferControlToOffscreen();
      CanvasTransferTracker.markTransferred(canvas);
      this.worker = new Worker(new URL('./preview.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;
        if (data.type === 'ready') {
          this.isReady = true;
          if (this.onReadyCallback) {
            this.onReadyCallback();
          }
        } else if (data.type === 'frameUpdate') {
          if (data.ended) {
            this.isPlaying = false;
          }
          if (this.onFrameUpdateCallback) {
            this.onFrameUpdateCallback(data.frame, data.ended);
          }
        } else if (data.type === 'frameRendered') {
          if (this.onFrameRenderedCallback) {
            this.onFrameRenderedCallback(data.frame, data.renderLatencyMs ?? 0);
          }
        }
      };

      this.worker.postMessage(
        {
          type: 'init',
          canvas: offscreen,
          timeline,
          width,
          height,
          fps,
          totalFrames,
          assets,
        },
        [offscreen]
      );

      this.isTransferred = true;
      return true;
    } catch (err) {
      console.warn(
        '[PreviewWorkerBridge] OffscreenCanvas transfer failed, falling back to main-thread canvas:',
        err
      );
      this.isSupported = false;
      return false;
    }
  }

  public updateTimeline(
    timeline: ResolvedTimeline,
    totalFrames: number,
    fps: number,
    assets?: Record<string, { src?: string; type?: string }>
  ): void {
    if (!this.worker || !this.isTransferred) return;
    this.worker.postMessage({
      type: 'updateTimeline',
      timeline,
      totalFrames,
      fps,
      assets,
    });
  }

  public syncAssets(assets: Record<string, { src?: string; type?: string }>): void {
    if (!this.worker || !this.isTransferred) return;
    this.worker.postMessage({
      type: 'syncAssets',
      assets,
    });
  }

  public resize(width: number, height: number): void {
    if (!this.worker || !this.isTransferred) return;
    this.worker.postMessage({
      type: 'resize',
      width,
      height,
    });
  }

  public renderFrame(
    frame: number,
    optionsOrLod?: WorkerRenderOptions | number,
    isScrubbing = false,
    clearColor?: string,
    debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha'
  ): void {
    if (!this.worker || !this.isTransferred) return;

    let lod = 1.0;
    let scrubbing = isScrubbing;
    let color = clearColor;
    let mode = debugMode;
    let playing = false;

    if (typeof optionsOrLod === 'object' && optionsOrLod !== null) {
      lod = optionsOrLod.lod ?? 1.0;
      scrubbing = optionsOrLod.isScrubbing ?? false;
      color = optionsOrLod.clearColor;
      mode = optionsOrLod.debugMode;
      playing = Boolean(optionsOrLod.isPlaying);
    } else if (typeof optionsOrLod === 'number') {
      lod = optionsOrLod;
    }

    this.worker.postMessage({
      type: 'renderFrame',
      frame,
      lod,
      isScrubbing: scrubbing,
      isPlaying: playing,
      clearColor: color,
      debugMode: mode,
    });
  }

  public requestFrame(
    frame: number,
    optionsOrLod?: WorkerRenderOptions | number,
    isScrubbing = false,
    clearColor?: string,
    debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha'
  ): void {
    this.renderFrame(frame, optionsOrLod, isScrubbing, clearColor, debugMode);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public startPlayback(
    speed: number,
    startFrame: number,
    fps: number,
    totalFrames: number,
    onFrameUpdate: (frame: number, ended?: boolean) => void
  ): void {
    if (!this.worker || !this.isTransferred) return;
    this.isPlaying = true;
    this.onFrameUpdateCallback = onFrameUpdate;
    this.worker.postMessage({
      type: 'startPlayback',
      speed,
      startFrame,
      fps,
      totalFrames,
    });
  }

  public stopPlayback(): void {
    if (!this.worker || !this.isTransferred) return;
    this.isPlaying = false;
    this.onFrameUpdateCallback = null;
    this.worker.postMessage({ type: 'stopPlayback' });
  }

  public updateTextures(textures: Record<string, ImageBitmap>): void {
    if (!this.worker || !this.isTransferred) return;
    const transferables = Object.values(textures);
    this.worker.postMessage(
      {
        type: 'updateTextures',
        textures,
      },
      transferables
    );
  }

  public destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isTransferred = false;
    this.isReady = false;
  }

  public dispose(): void {
    this.destroy();
  }

  public [Symbol.dispose](): void {
    this.destroy();
  }
}
