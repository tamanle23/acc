import type { TimelineRenderModel, TimelineViewportState } from '../../workers/timelineTypes';

export class TimelineWorkerBridge {
  private worker: Worker | null = null;
  private isSupported: boolean = false;
  private isTransferred: boolean = false;
  private isReady: boolean = false;

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

  public hasTransferred(): boolean {
    return this.isTransferred;
  }

  public init(
    canvas: HTMLCanvasElement,
    model: TimelineRenderModel,
    viewport: TimelineViewportState
  ): boolean {
    if (!this.isSupported) return false;
    if (this.isTransferred) return true;

    // A canvas DOM node cannot be transferred more than once across its entire lifecycle
    if ((canvas as any).__transferred) {
      return false;
    }

    try {
      const offscreen = canvas.transferControlToOffscreen();
      (canvas as any).__transferred = true;
      this.worker = new Worker(new URL('../../workers/timeline.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;
        if (data.type === 'ready') {
          this.isReady = true;
        }
      };

      this.worker.postMessage(
        {
          type: 'init',
          canvas: offscreen,
          model,
          viewport,
        },
        [offscreen]
      );

      this.isTransferred = true;
      return true;
    } catch (err) {
      console.warn('[TimelineWorkerBridge] OffscreenCanvas transfer failed, falling back to main-thread canvas:', err);
      this.isSupported = false;
      return false;
    }
  }

  public updateViewport(viewport: Partial<TimelineViewportState>): void {
    if (!this.worker || !this.isTransferred) return;
    this.worker.postMessage({
      type: 'updateViewport',
      viewport,
    });
  }

  public updateModel(model: TimelineRenderModel): void {
    if (!this.worker || !this.isTransferred) return;
    this.worker.postMessage({
      type: 'updateModel',
      model,
    });
  }

  public triggerRender(): void {
    if (!this.worker || !this.isTransferred) return;
    this.worker.postMessage({
      type: 'render',
    });
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isTransferred = false;
      this.isReady = false;
    }
  }
}
