import type { CanvasSink } from 'mediabunny';

/**
 * SequentialVideoReader:
 * Zero-copy circular ping-pong double buffer for sequential video playback.
 * Pre-allocates exactly two OffscreenCanvas instances (Slot A and Slot B)
 * and continuously extracts video frames without creating any intermediate
 * VideoFrame or ImageBitmap allocations per tick.
 */
export class SequentialVideoReader {
  private canvasA: OffscreenCanvas | null = null;
  private canvasB: OffscreenCanvas | null = null;
  private ctxA: OffscreenCanvasRenderingContext2D | null = null;
  private ctxB: OffscreenCanvasRenderingContext2D | null = null;
  private activeSlot: 'A' | 'B' = 'A';
  private currentFrame = -1;
  private preloadedFrame = -1;
  private isPreloading = false;
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
        this.ctxA = this.canvasA.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
        this.ctxB = this.canvasB.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
      } catch (err) {
        console.warn('[SequentialVideoReader] Failed to allocate OffscreenCanvases:', err);
      }
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

    // 2. If requested frame matches preloaded frame in inactive slot, swap!
    if (this.preloadedFrame === frame) {
      this.swap();
      this.currentFrame = frame;
      this.preloadNext(frame + 1, fps);
      return this.getActiveCanvas();
    }

    // 3. Otherwise (seek/startup/miss), decode directly into active slot
    const painted = await this.paintSlot(this.activeSlot, frame, fps);
    if (painted) {
      this.currentFrame = frame;
      this.preloadNext(frame + 1, fps);
      return this.getActiveCanvas();
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
        const raw = typeof wrapped.getRawCanvas === 'function'
          ? wrapped.getRawCanvas()
          : wrapped.canvas || wrapped;

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
    const inactive = this.getInactiveSlot();
    try {
      const success = await this.paintSlot(inactive, frame, fps);
      if (success) {
        this.preloadedFrame = frame;
      }
    } finally {
      this.isPreloading = false;
    }
  }

  public reset(): void {
    this.currentFrame = -1;
    this.preloadedFrame = -1;
    this.isPreloading = false;
  }

  public dispose(): void {
    this.reset();
    this.canvasA = null;
    this.canvasB = null;
    this.ctxA = null;
    this.ctxB = null;
    this.canvasSink = null;
  }
}
