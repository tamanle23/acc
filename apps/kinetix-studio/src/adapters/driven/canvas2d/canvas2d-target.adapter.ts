// ============================================================================
// KINETIX STUDIO - DRIVEN ADAPTER: CANVAS2D RENDER TARGET ADAPTER (ECMA-429)
// Implements IRenderTargetPort wrapping HTMLCanvasElement, OffscreenCanvas,
// or AnyCanvas2DContext using SafeCanvas2D defensiveness.
// ============================================================================

import type { IRenderTargetPort } from '@/core/ports/driven/render-target.port';
import { SafeCanvas2D, type AnyCanvas2DContext } from '@/lib/safe-canvas-2d';

export class Canvas2dRenderTargetAdapter implements IRenderTargetPort {
  private readonly sctx: SafeCanvas2D;
  private readonly canvasElement: HTMLCanvasElement | OffscreenCanvas | null;
  public readonly width: number;
  public readonly height: number;

  constructor(
    sourceOrWidth: HTMLCanvasElement | OffscreenCanvas | AnyCanvas2DContext | number,
    maybeHeight?: number
  ) {
    if (typeof sourceOrWidth === 'number') {
      this.width = sourceOrWidth;
      this.height = maybeHeight ?? sourceOrWidth;
      if (typeof OffscreenCanvas !== 'undefined') {
        const offscreen = new OffscreenCanvas(this.width, this.height);
        this.canvasElement = offscreen;
        const ctx = offscreen.getContext('2d');
        if (!ctx) throw new Error('Could not create 2D context on OffscreenCanvas');
        this.sctx = new SafeCanvas2D(ctx);
      } else if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this.canvasElement = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create 2D context on HTMLCanvasElement');
        this.sctx = new SafeCanvas2D(ctx);
      } else {
        throw new Error('Neither OffscreenCanvas nor document is available in this runtime');
      }
    } else if ('getContext' in sourceOrWidth) {
      this.canvasElement = sourceOrWidth;
      this.width = sourceOrWidth.width;
      this.height = sourceOrWidth.height;
      const ctx = sourceOrWidth.getContext('2d') as AnyCanvas2DContext | null;
      if (!ctx) throw new Error('Could not acquire 2d context from canvas');
      this.sctx = new SafeCanvas2D(ctx);
    } else {
      // It's already a context
      this.canvasElement = null;
      this.sctx = new SafeCanvas2D(sourceOrWidth);
      this.width = (sourceOrWidth.canvas as { width?: number })?.width ?? (maybeHeight ?? 1080);
      this.height = (sourceOrWidth.canvas as { height?: number })?.height ?? (maybeHeight ?? 1920);
    }
  }

  public getContext(): SafeCanvas2D {
    return this.sctx;
  }

  public getCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
    return this.canvasElement;
  }

  save(): void { this.sctx.save(); }
  restore(): void { this.sctx.restore(); }
  translate(x: number, y: number): void { this.sctx.translate(x, y); }
  scale(x: number, y: number): void { this.sctx.scale(x, y); }
  rotate(radians: number): void { this.sctx.rotate(radians); }

  beginPath(): void { this.sctx.beginPath(); }
  closePath(): void { this.sctx.closePath(); }
  moveTo(x: number, y: number): void { this.sctx.moveTo(x, y); }
  lineTo(x: number, y: number): void { this.sctx.lineTo(x, y); }
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.sctx.arc(x, y, radius, startAngle, endAngle, counterclockwise);
  }
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.sctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.sctx.quadraticCurveTo(cpx, cpy, x, y);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.sctx.rect(x, y, w, h);
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.sctx.clearRect(x, y, w, h);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.sctx.fillRect(x, y, w, h);
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.sctx.strokeRect(x, y, w, h);
  }

  fill(): void { this.sctx.fill(); }
  stroke(): void { this.sctx.stroke(); }
  clip(): void { this.sctx.clip(); }

  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.sctx.fillText(text, x, y, maxWidth);
  }
  strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    this.sctx.strokeText(text, x, y, maxWidth);
  }
  measureText(text: string): { width: number } {
    return this.sctx.measureText(text);
  }

  setFillStyle(colorOrPattern: string | unknown): void {
    this.sctx.fillStyle = colorOrPattern as string;
  }
  setStrokeStyle(colorOrPattern: string | unknown): void {
    this.sctx.strokeStyle = colorOrPattern as string;
  }
  setLineWidth(width: number): void {
    this.sctx.lineWidth = width;
  }
  setGlobalAlpha(alpha: number): void {
    this.sctx.globalAlpha = alpha;
  }
  setGlobalCompositeOperation(op: string): void {
    this.sctx.globalCompositeOperation = op as GlobalCompositeOperation;
  }
  setFont(font: string): void {
    this.sctx.font = font;
  }
  setTextAlign(align: 'left' | 'right' | 'center' | 'start' | 'end'): void {
    this.sctx.textAlign = align;
  }
  setTextBaseline(baseline: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom'): void {
    this.sctx.textBaseline = baseline;
  }

  async toBlob(mimeType = 'image/png', quality?: number): Promise<Blob | null> {
    if (!this.canvasElement) return null;
    if ('convertToBlob' in this.canvasElement) {
      return (this.canvasElement as OffscreenCanvas).convertToBlob({ type: mimeType, quality });
    }
    return new Promise((resolve) => {
      (this.canvasElement as HTMLCanvasElement).toBlob(resolve, mimeType, quality);
    });
  }

  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData | null {
    return this.sctx.getImageData(sx, sy, sw, sh);
  }
}
