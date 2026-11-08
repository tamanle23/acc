import type { CanvasSink } from 'mediabunny';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';

/**
 * SequentialVideoReader:
 * Zero-copy circular ping-pong double buffer for sequential video playback.
 * Pre-allocates exactly two OffscreenCanvas instances (Slot A and Slot B)
 * and continuously extracts video frames without creating any intermediate
 * VideoFrame or ImageBitmap allocations per tick.
 */
export class SequentialVideoReader implements Disposable {
  private canvasA: OffscreenCanvas | null = null;
  private canvasB: OffscreenCanvas | null = null;
  private ctxA: OffscreenCanvasRenderingContext2D | null = null;
  private ctxB: OffscreenCanvasRenderingContext2D | null = null;
  private activeSlot: 'A' | 'B' = 'A';
  private currentFrame = -1;
  private preloadedFrame = -1;
  private preloadingFrame = -1;
  private isPreloading = false;
  private preloadPromise: Promise<boolean> | null = null;
  private width: number;
  private height: number;
  private canvasSink: CanvasSink | null;

  constructor(canvasSink: CanvasSink | null, width: number, height: number) {
    this.canvasSink = canvasSink;
    this.width = width;
    this.height = height;
    this.initCanvases();
  }

  private initCanvases(): void {
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        this.canvasA = new OffscreenCanvas(this.width, this.height);
        this.canvasB = new OffscreenCanvas(this.width, this.height);
        // Mark persistent circular ping-pong buffer canvases as shared singletons
        // so that generic frame-scope disposers never close them.
        (this.canvasA as any)._isShared = true;
        (this.canvasB as any)._isShared = true;
        this.ctxA = this.canvasA.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
        this.ctxB = this.canvasB.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
      } catch (err) {
        console.warn('[SequentialVideoReader] Failed to allocate OffscreenCanvases:', err);
      }
    } else {
      try {
        const uA = UniversalCanvasProvider.createCanvas(this.width, this.height);
        const uB = UniversalCanvasProvider.createCanvas(this.width, this.height);
        this.canvasA = (uA as any).canvas || uA;
        this.canvasB = (uB as any).canvas || uB;
        (this.canvasA as any)._isShared = true;
        (this.canvasB as any)._isShared = true;
        this.ctxA = uA.getContext('2d') as any;
        this.ctxB = uB.getContext('2d') as any;
      } catch { }
    }
  }

  public getActiveCanvas(): OffscreenCanvas | null {
    return this.activeSlot === 'A' ? this.canvasA : this.canvasB;
  }

  private getInactiveSlot(): 'A' | 'B' {
    return this.activeSlot === 'A' ? 'B' : 'A';
  }

  private swap(): void {
    this.activeSlot = this.getInactiveSlot();
  }

  /**
   * Retrieves the active OffscreenCanvas containing the requested playback frame.
   * Swaps slots if next frame is already pre-painted in inactive slot.
   * Dispatches background paint for next sequential frame (frame + 1).
   */
  public async getFrameCanvas(frame: number, fps: number): Promise<OffscreenCanvas | null> {
    if (!this.canvasA || !this.canvasB) {
      this.initCanvases();
      if (!this.canvasA || !this.canvasB) return null;
    }

    // 1. If requested frame is already the active frame, return current canvas
    if (this.currentFrame === frame) {
      return this.getActiveCanvas();
    }

    // 2. If requested frame is currently being preloaded in inactive slot, await it!
    if (this.isPreloading && this.preloadingFrame === frame && this.preloadPromise) {
      await this.preloadPromise;
    }

    // 3. If requested frame matches preloaded frame in inactive slot, swap!
    if (this.preloadedFrame === frame) {
      this.swap();
      this.currentFrame = frame;
      void this.preloadNext(frame + 1, fps);
      return this.getActiveCanvas();
    }

    // 4. Otherwise (seek/startup/miss), decode directly into active slot
    const painted = await this.paintSlot(this.activeSlot, frame, fps);
    if (painted) {
      this.currentFrame = frame;
      void this.preloadNext(frame + 1, fps);
      return this.getActiveCanvas();
    }

    // 5. Zero-Blackout Hold-On-Miss Guarantee:
    // If target frame decode is delayed or dropped, retain and return the active canvas slot
    // to prevent downstream compositors from painting an opaque black fallback.
    const heldCanvas = this.getActiveCanvas();
    if (heldCanvas && this.currentFrame >= 0) {
      void this.preloadNext(frame + 1, fps);
      return heldCanvas;
    }

    return null;
  }

  private async paintSlot(slot: 'A' | 'B', frame: number, fps: number): Promise<boolean> {
    const targetCanvas = slot === 'A' ? this.canvasA : this.canvasB;
    const targetCtx = slot === 'A' ? this.ctxA : this.ctxB;
    if (!targetCtx || !this.canvasSink || !targetCanvas) return false;

    const sec = Math.max(0, frame / (fps || 30));
    try {
      const wrapped = await this.canvasSink.getCanvas(sec);
      if (wrapped) {
        const raw = typeof (wrapped as any).getRawCanvas === 'function'
          ? (wrapped as any).getRawCanvas()
          : (wrapped as any).canvas || wrapped;

        if (raw) {
          const w = raw.width || this.width || 1920;
          const h = raw.height || this.height || 1080;
          if (targetCanvas.width !== w || targetCanvas.height !== h) {
            targetCanvas.width = w;
            targetCanvas.height = h;
            this.width = w;
            this.height = h;
          }
          targetCtx.clearRect(0, 0, w, h);
          targetCtx.drawImage(raw, 0, 0, w, h);
          return true;
        }
      }
    } catch (err) {
      console.warn('[SequentialVideoReader] paintSlot error:', err);
    }
    return false;
  }

  private async preloadNext(frame: number, fps: number): Promise<void> {
    if (this.isPreloading || this.preloadedFrame === frame) return;
    this.isPreloading = true;
    this.preloadingFrame = frame;
    const inactive = this.getInactiveSlot();
    const promise = this.paintSlot(inactive, frame, fps);
    this.preloadPromise = promise;
    try {
      const success = await promise;
      if (success) {
        this.preloadedFrame = frame;
      }
    } finally {
      this.isPreloading = false;
      this.preloadPromise = null;
      this.preloadingFrame = -1;
    }
  }

  public reset(): void {
    this.currentFrame = -1;
    this.preloadedFrame = -1;
    this.preloadingFrame = -1;
    this.isPreloading = false;
    this.preloadPromise = null;
  }

  public dispose(): void {
    this.reset();
    this.canvasA = null;
    this.canvasB = null;
    this.ctxA = null;
    this.ctxB = null;
    this.canvasSink = null;
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }
}
