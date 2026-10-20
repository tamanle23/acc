/**
 * ContentHashTextureCache:
 * Hashes static text, typography styles, and vector shape properties with FNV-1a.
 * Rasterizes once to an OffscreenCanvas bitmap, then re-uses the cached ImageBitmap
 * across 60fps frame loops while applying keyframe matrix transforms & opacity dynamically.
 */
export interface TextRasterOptions {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  maxWidth?: number;
  lineHeight?: number;
}

export class ContentHashTextureCache {
  private static instance: ContentHashTextureCache;
  private cache = new Map<number, ImageBitmap>();
  private scratchCanvas: OffscreenCanvas | null = null;
  private scratchCtx: OffscreenCanvasRenderingContext2D | null = null;

  private constructor() {
    if (typeof OffscreenCanvas !== 'undefined') {
      this.scratchCanvas = new OffscreenCanvas(1024, 256);
      this.scratchCtx = this.scratchCanvas.getContext('2d', { willReadFrequently: false });
    }
  }

  public static getInstance(): ContentHashTextureCache {
    if (!ContentHashTextureCache.instance) {
      ContentHashTextureCache.instance = new ContentHashTextureCache();
    }
    return ContentHashTextureCache.instance;
  }

  /**
   * 32-bit FNV-1a hash algorithm.
   */
  public hashString(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /**
   * Retrieves or asynchronously rasterizes static text into an ImageBitmap.
   */
  public async getRasterizedText(options: TextRasterOptions): Promise<ImageBitmap | null> {
    const keyStr = `${options.text}:${options.fontSize || 32}:${options.fontFamily || 'sans-serif'}:${options.fontWeight || 'bold'}:${options.color || '#ffffff'}:${options.strokeColor || ''}:${options.strokeWidth || 0}`;
    const hash = this.hashString(keyStr);

    const existing = this.cache.get(hash);
    if (existing) return existing;

    if (!this.scratchCanvas || !this.scratchCtx || typeof createImageBitmap !== 'function') {
      return null;
    }

    const ctx = this.scratchCtx;
    const fontSize = options.fontSize || 32;
    const fontFamily = options.fontFamily || 'sans-serif';
    const fontWeight = options.fontWeight || 'bold';

    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(options.text);
    const textWidth = Math.ceil(metrics.width) + 16;
    const textHeight = Math.ceil(fontSize * 1.4) + 16;

    // Resize scratch canvas if needed
    if (this.scratchCanvas.width < textWidth || this.scratchCanvas.height < textHeight) {
      this.scratchCanvas.width = Math.max(this.scratchCanvas.width, textWidth);
      this.scratchCanvas.height = Math.max(this.scratchCanvas.height, textHeight);
    }

    ctx.clearRect(0, 0, textWidth, textHeight);
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';

    // Stroke
    if (options.strokeColor && options.strokeWidth) {
      ctx.strokeStyle = options.strokeColor;
      ctx.lineWidth = options.strokeWidth;
      ctx.strokeText(options.text, 8, 8);
    }

    // Fill
    ctx.fillStyle = options.color || '#ffffff';
    ctx.fillText(options.text, 8, 8);
    ctx.restore();

    try {
      const bitmap = await createImageBitmap(this.scratchCanvas, 0, 0, textWidth, textHeight);
      this.cache.set(hash, bitmap);
      return bitmap;
    } catch {
      return null;
    }
  }

  public get(hash: number): ImageBitmap | undefined {
    return this.cache.get(hash);
  }

  public has(hash: number): boolean {
    return this.cache.has(hash);
  }

  public set(hash: number, bitmap: ImageBitmap): void {
    const existing = this.cache.get(hash);
    if (existing && existing !== bitmap) {
      try {
        existing.close();
      } catch {}
    }
    this.cache.set(hash, bitmap);
  }

  public clear(): void {
    for (const [, bmp] of this.cache) {
      try {
        bmp.close();
      } catch {}
    }
    this.cache.clear();
  }
}
