// ============================================================================
// KINETIX STUDIO - DRIVEN PORT: RENDER TARGET PORT (ECMA-429)
// Pure architectural interface decoupling 2D drawing surfaces (DOM Canvas,
// OffscreenCanvas, Headless Mock) from application choreography & domain rendering.
// ============================================================================

export interface RenderTargetMetrics {
  width: number;
  height: number;
}

export interface IRenderTargetPort {
  readonly width: number;
  readonly height: number;

  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  rotate(radians: number): void;

  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void;

  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;

  fill(): void;
  stroke(): void;
  clip(): void;

  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };

  setFillStyle(colorOrPattern: string | unknown): void;
  setStrokeStyle(colorOrPattern: string | unknown): void;
  setLineWidth(width: number): void;
  setGlobalAlpha(alpha: number): void;
  setGlobalCompositeOperation(op: string): void;
  setFont(font: string): void;
  setTextAlign(align: 'left' | 'right' | 'center' | 'start' | 'end'): void;
  setTextBaseline(baseline: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom'): void;

  toBlob(mimeType?: string, quality?: number): Promise<Blob | null>;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData | null;
}
