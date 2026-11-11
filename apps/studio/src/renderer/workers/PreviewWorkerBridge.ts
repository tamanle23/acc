import type { ResolvedTimeline } from '@acc/ir';
import { CanvasTransferTracker } from '@acc/core-web';

export interface WorkerRenderOptions {
  lod?: number;
  isScrubbing?: boolean;
  isPlaying?: boolean;
  clearColor?: string;
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha';
}

const GLOBAL_BRIDGE_KEY = Symbol.for('@acc/studio/PreviewWorkerBridge');

export class PreviewWorkerBridge implements Disposable {
  private static instance: PreviewWorkerBridge | null = null;
  private worker: Worker | null = null;
  private isSupported: boolean = false;
  private isTransferred: boolean = false;
  private isReady: boolean = false;
  private onFrameRenderedCallback: ((frame: number, latencyMs: number) => void) | null = null;
  private onReadyCallback: (() => void) | null = null;
  private workerMessageListeners = new Set<(e: MessageEvent) => void>();

  public static getInstance(): PreviewWorkerBridge {
    const g = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
    if (g && g[GLOBAL_BRIDGE_KEY]) {
      PreviewWorkerBridge.instance = g[GLOBAL_BRIDGE_KEY];
      return PreviewWorkerBridge.instance!;
    }

    if (!PreviewWorkerBridge.instance) {
      PreviewWorkerBridge.instance = new PreviewWorkerBridge();
      if (g) {
        g[GLOBAL_BRIDGE_KEY] = PreviewWorkerBridge.instance;
      }
    }
    return PreviewWorkerBridge.instance;
  }

  public getWorker(): Worker | null {
    if (!this.worker && this.isSupported) {
      this.ensureWorker();
    }
    return this.worker;
  }

  public addMessageListener(listener: (e: MessageEvent) => void): () => void {
    this.workerMessageListeners.add(listener);
    return () => {
      this.workerMessageListeners.delete(listener);
    };
  }

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

  private ensureWorker(): void {
    if (this.worker) return;
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
      } else if (data.type === 'frameRendered') {
        if (this.onFrameRenderedCallback) {
          this.onFrameRenderedCallback(data.frame, data.renderLatencyMs ?? 0);
        }
      }

      // Notify external subscribers (e.g. PreviewWorkerCoordinator sidecar tasks)
      for (const listener of this.workerMessageListeners) {
        try {
          listener(e);
        } catch (err) {
          console.error('[PreviewWorkerBridge] Message listener error:', err);
        }
      }
    };
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
      this.ensureWorker();

      this.worker!.postMessage(
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
