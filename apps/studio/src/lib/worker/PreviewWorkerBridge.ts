import type { ResolvedTimeline } from '@acc/ir';

export class PreviewWorkerBridge {
  private worker: Worker | null = null;
  private isSupported: boolean = false;
  private isTransferred: boolean = false;
  private isReady: boolean = false;
  private onFrameUpdateCallback: ((frame: number, ended?: boolean) => void) | null = null;
  private onReadyCallback: (() => void) | null = null;

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
    if (this.isTransferred) return true;

    try {
      const offscreen = canvas.transferControlToOffscreen();
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
          if (this.onFrameUpdateCallback) {
            this.onFrameUpdateCallback(data.frame, data.ended);
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
      console.warn('[PreviewWorkerBridge] OffscreenCanvas transfer failed, falling back to main-thread canvas:', err);
      this.isSupported = false;
      return false;
    }
  }

  public updateTimeline(
    timeline: ResolvedTimeline,
    totalFrames: number,
    fps: number,
    popOutIntensity?: number,
    assets?: Record<string, { src?: string; type?: string }>
  ) {
    if (!this.worker || !this.isTransferred) return;
    this.worker.postMessage({
      type: 'updateTimeline',
      timeline,
      totalFrames,
      fps,
      popOutIntensity,
      assets,
    });
  }

  public syncAssets(assets: Record<string, { src?: string; type?: string }>) {
    if (!this.worker || !this.isTransferred) return;
    this.worker.postMessage({
      type: 'syncAssets',
      assets,
    });
  }

  public renderFrame(
    frame: number,
    lod = 1.0,
    popOutIntensity = 1.0,
    isScrubbing = false,
    clearColor?: string,
    debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha'
  ) {
    if (!this.worker || !this.isTransferred) return;
    this.worker.postMessage({
      type: 'renderFrame',
      frame,
      lod,
      popOutIntensity,
      isScrubbing,
      clearColor,
      debugMode,
    });
  }

  public requestFrame(
    frame: number,
    lod = 1.0,
    popOutIntensity = 1.0,
    isScrubbing = false,
    clearColor?: string,
    debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha'
  ) {
    this.renderFrame(frame, lod, popOutIntensity, isScrubbing, clearColor, debugMode);
  }

  public startPlayback(
    speed: number,
    startFrame: number,
    fps: number,
    totalFrames: number,
    onFrameUpdate: (frame: number, ended?: boolean) => void
  ) {
    if (!this.worker || !this.isTransferred) return;
    this.onFrameUpdateCallback = onFrameUpdate;
    this.worker.postMessage({
      type: 'startPlayback',
      speed,
      startFrame,
      fps,
      totalFrames,
    });
  }

  public stopPlayback() {
    if (!this.worker || !this.isTransferred) return;
    this.onFrameUpdateCallback = null;
    this.worker.postMessage({ type: 'stopPlayback' });
  }

  public updateTextures(textures: Record<string, ImageBitmap>) {
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

  public destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isTransferred = false;
    this.isReady = false;
  }
}
