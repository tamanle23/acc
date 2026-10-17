export type CanvasEnvironment = 'auto' | 'web' | 'node';

export interface CanvasContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
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
  strokeRect?(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  closePath?(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc?(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  ellipse?(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  stroke(): void;
  fill?(): void;
  save(): void;
  restore(): void;
  drawImage?(image: any, dx: number, dy: number, dw?: number, dh?: number): void;
  getImageData?(sx: number, sy: number, sw: number, sh: number): ImageData;
  putImageData?(imagedata: ImageData, dx: number, dy: number): void;
  createLinearGradient?(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  createRadialGradient?(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;
  measureText?(text: string): TextMetrics;
}

export interface CanvasInstance {
  readonly width: number;
  readonly height: number;
  getContext(contextId: '2d'): CanvasContext2D | any;
  /** Returns raw RGBA pixel data or encoded format (png, jpeg) */
  toBuffer(mimeType?: string): Buffer | Uint8Array;
  toDataURL?(mimeType?: string): string;
  toBlob?(mimeType?: string): Promise<Blob>;
  getRawCanvas?: () => any;
}

export interface CanvasAdapter {
  readonly name: string;
  readonly environment: 'web' | 'node';
  createCanvas(width: number, height: number): CanvasInstance;
  isSupported(): boolean;
}
