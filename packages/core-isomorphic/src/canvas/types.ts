export type CanvasEnvironment = 'auto' | 'web' | 'node';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}


export interface ICanvasGradient {
  addColorStop(offset: number, color: string): void;
}

export interface ICanvasPattern {
  setTransform?(transform?: any): void;
}

export interface IImageData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  readonly colorSpace?: string;
}

export interface ITextMetrics {
  readonly width: number;
  readonly actualBoundingBoxLeft?: number;
  readonly actualBoundingBoxRight?: number;
  readonly fontBoundingBoxAscent?: number;
  readonly fontBoundingBoxDescent?: number;
  readonly actualBoundingBoxAscent?: number;
  readonly actualBoundingBoxDescent?: number;
}

export type CanvasTextAlign = 'left' | 'right' | 'center' | 'start' | 'end';
export type CanvasTextBaseline = 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';

export interface ICanvasContext2D {
  fillStyle: string | ICanvasGradient | ICanvasPattern | any;
  strokeStyle: string | ICanvasGradient | ICanvasPattern | any;
  lineWidth: number;
  globalAlpha: number;
  lineCap: 'butt' | 'round' | 'square';
  globalCompositeOperation?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  font?: string;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  ellipse?(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  stroke(): void;
  fill(fillRule?: 'nonzero' | 'evenodd'): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  drawImage(image: any, dx: number, dy: number, dw?: number, dh?: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): IImageData;
  putImageData(imagedata: IImageData | any, dx: number, dy: number): void;
  createImageData(sw: number, sh: number): IImageData;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): ICanvasGradient;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): ICanvasGradient;
  measureText(text: string): ITextMetrics;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText?(text: string, x: number, y: number, maxWidth?: number): void;
  setLineDash?(segments: number[]): void;
  getLineDash?(): number[];
  clip(fillRule?: 'nonzero' | 'evenodd'): void;
  resetTransform?(): void;
  [key: string]: any;
}

export interface ICanvasInstance {
  readonly width: number;
  readonly height: number;
  getContext(contextId: '2d'): ICanvasContext2D;
  /** Returns raw RGBA pixel data or encoded format (png, jpeg) */
  toBuffer(mimeType?: string): Buffer | Uint8Array;
  toDataURL?(mimeType?: string): string;
  toBlob?(mimeType?: string): Promise<Blob>;
  data?(): Uint8Array;
  getRawCanvas?(): unknown;
}

export interface ICanvasAdapter {
  readonly name: string;
  readonly environment: 'web' | 'node' | 'custom';
  isSupported(): boolean;
  createCanvas(width: number, height: number): ICanvasInstance;
  acquireScratchCanvas?(width: number, height: number): ICanvasInstance;
  releaseScratchCanvas?(canvas: ICanvasInstance): void;
  loadImage?(source: string | Buffer | Uint8Array | Blob | File): Promise<any>;
}

// Backward-compatibility type aliases
export type CanvasGradient = ICanvasGradient;
export type CanvasPattern = ICanvasPattern;
export type ImageData = IImageData;
export type TextMetrics = ITextMetrics;
export type CanvasContext2D = ICanvasContext2D;
export type CanvasInstance = ICanvasInstance;
export type CanvasAdapter = ICanvasAdapter;
