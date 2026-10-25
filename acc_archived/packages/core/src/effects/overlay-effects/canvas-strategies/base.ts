export interface CanvasContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  lineCap: 'butt' | 'round' | 'square';
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  save(): void;
  restore(): void;
}

export interface CanvasInstance {
  width: number;
  height: number;
  getContext(contextId: '2d'): CanvasContext2D;
  /** Returns raw RGBA pixel data */
  toBuffer(mimeType?: string): Buffer | Uint8Array;
  getRawCanvas?: () => any;
}

export interface CanvasAdapter {
  createCanvas(width: number, height: number): CanvasInstance;
  acquireScratchCanvas?(width: number, height: number): CanvasInstance;
  releaseScratchCanvas?(canvas: CanvasInstance): void;
}
