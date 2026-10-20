import { DeterministicTimelineClock } from '@acc/core-isomorphic';

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

export type WorkerMessage = InitMessage | DispatchFrameMessage | UpdateTimelineMessage | ResizeMessage;

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
  private maxForward: number = 120;
  private maxBackward: number = 30;

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
      if (cachedFrame < currentFrame - this.maxBackward || cachedFrame > currentFrame + this.maxForward) {
        this.cache.delete(cachedFrame);
      }
    }
  }
}

/**
 * PreviewRenderWorker Core:
 * Handles OffscreenCanvas rasterization in a dedicated worker thread.
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

  public handleMessage(msg: WorkerMessage, postMessage: (data: FrameAckPayload) => void): void {
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
        // Dynamic Scrub LOD: If scrubbing at >3x speed, scale resolution to 0.5x
        let lod = msg.lod ?? (Math.abs(speed) > 3.0 ? 0.5 : 1.0);

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
          // Render frame onto canvas context
          this.renderToContext(this.ctx, frame, lod);
          if (typeof this.ctx.getImageData === 'function') {
            try {
              const imgData = this.ctx.getImageData(0, 0, Math.min(100, this.width), Math.min(100, this.height));
              this.frameCache.set(frame, imgData);
            } catch {
              // Ignore in headless / worker environments without full DOM ImageData
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

  private renderToContext(ctx: any, frame: number, lod: number): void {
    if (!ctx) return;
    const w = this.width * lod;
    const h = this.height * lod;

    ctx.save?.();
    if (ctx.clearRect) ctx.clearRect(0, 0, this.width, this.height);
    if (ctx.fillStyle !== undefined) ctx.fillStyle = '#0a0a0a';
    if (ctx.fillRect) ctx.fillRect(0, 0, this.width, this.height);

    // Frame indicator line / blit
    if (ctx.fillStyle !== undefined) ctx.fillStyle = '#00ffff';
    if (ctx.fillRect) ctx.fillRect(0, 0, (frame % 100) * 5, 4);

    ctx.restore?.();
  }
}

// Global Worker message hook if executed inside WorkerGlobalScope
if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
  const workerCore = new PreviewRenderWorkerCore();
  self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    workerCore.handleMessage(e.data, (payload) => (self as any).postMessage(payload));
  };
}
