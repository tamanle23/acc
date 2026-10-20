/**
 * AssetTextureCache:
 * High-performance LRU texture and thumbnail cache for Studio.
 * Seamlessly decodes real image/video files into HTMLCanvasElement / ImageBitmap,
 * and procedurally generates rich sci-fi filmstrips and 3D textures for mock asset IDs.
 */
export interface VisualAssetResult {
  source: CanvasImageSource | null;
  width: number;
  height: number;
  isReady: boolean;
  type: 'image' | 'video' | 'placeholder';
}

export class AssetTextureCache {
  private static instance: AssetTextureCache;
  private canvasCache = new Map<string, HTMLCanvasElement>();
  private dataUrlCache = new Map<string, string>();
  private imageCache = new Map<string, { img: HTMLImageElement; isReady: boolean }>();
  private videoCache = new Map<string, { video: HTMLVideoElement; isReady: boolean }>();
  private placeholderCache = new Map<string, HTMLCanvasElement>();
  private subscribers = new Set<() => void>();

  private constructor() {}

  public static getInstance(): AssetTextureCache {
    if (!AssetTextureCache.instance) {
      AssetTextureCache.instance = new AssetTextureCache();
    }
    return AssetTextureCache.instance;
  }

  /**
   * Subscribes to asset decoding readiness events.
   * Automatically called when an image or video finishes decoding in the background.
   */
  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    for (const sub of this.subscribers) {
      try {
        sub();
      } catch (err) {
        console.error('[AssetTextureCache] Subscriber error:', err);
      }
    }
  }

  /**
   * Retrieves or asynchronously loads a visual asset (Image or Video decoder).
   * If not yet decoded or if URL fails, returns an isolated dark video placeholder canvas.
   */
  public getVisualAsset(
    assetId: string,
    src?: string,
    assetType: 'image' | 'media' | 'video' = 'image',
    timeSec: number = 0
  ): VisualAssetResult {
    // 1. If real URL provided and image type
    if (src && (assetType === 'image' || src.match(/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i))) {
      let entry = this.imageCache.get(src);
      if (!entry) {
        if (typeof Image !== 'undefined') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          entry = { img, isReady: false };
          img.onload = () => {
            entry!.isReady = true;
            this.notify();
          };
          img.onerror = () => {
            console.warn(`[AssetTextureCache] Failed to load image: ${src}`);
          };
          img.src = src;
          this.imageCache.set(src, entry);
        }
      }

      if (entry && entry.isReady && entry.img.naturalWidth > 0) {
        return {
          source: entry.img,
          width: entry.img.naturalWidth,
          height: entry.img.naturalHeight,
          isReady: true,
          type: 'image',
        };
      }
    }

    // 2. If real URL provided and video/media type
    if (src && (assetType === 'media' || assetType === 'video' || src.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i))) {
      let vEntry = this.videoCache.get(src);
      if (!vEntry) {
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          video.muted = true;
          video.playsInline = true;
          video.preload = 'auto';
          vEntry = { video, isReady: false };

          video.onloadeddata = () => {
            vEntry!.isReady = true;
            this.notify();
          };
          video.onerror = () => {
            console.warn(`[AssetTextureCache] Failed to load video: ${src}`);
          };
          video.src = src;
          this.videoCache.set(src, vEntry);
        }
      }

      if (vEntry && vEntry.isReady && vEntry.video.videoWidth > 0) {
        // Direct seek without audio un-mute
        const targetTime = Math.max(0, timeSec);
        if (Math.abs(vEntry.video.currentTime - targetTime) > 0.05) {
          try {
            vEntry.video.currentTime = targetTime;
          } catch {}
        }
        return {
          source: vEntry.video,
          width: vEntry.video.videoWidth,
          height: vEntry.video.videoHeight,
          isReady: true,
          type: 'video',
        };
      }
    }

    // 3. Fallback to Neutral Dark Video Charcoal (#151518) Isolated Placeholder
    const phCanvas = this.renderMissingAssetPlaceholder(assetId, assetType);
    return {
      source: phCanvas,
      width: phCanvas.width,
      height: phCanvas.height,
      isReady: true,
      type: 'placeholder',
    };
  }

  /**
   * Renders a neutral dark video charcoal (#151518) placeholder adhering to Rule 235 isolation.
   */
  public renderMissingAssetPlaceholder(
    assetId: string,
    assetType: string = 'media',
    width = 640,
    height = 360
  ): HTMLCanvasElement {
    const key = `ph:${assetId}:${width}:${height}`;
    if (this.placeholderCache.has(key)) {
      return this.placeholderCache.get(key)!;
    }

    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return {} as any;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // 1. Dark charcoal video background (isolated from desktop themes)
      ctx.fillStyle = '#151518';
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle dashed perimeter guide
      ctx.strokeStyle = '#2a2a30';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(12, 12, width - 24, height - 24);
      ctx.setLineDash([]);

      // 3. Neutral Asset Type Badge
      const isVideo = assetType === 'media' || assetType === 'video';
      ctx.fillStyle = '#222227';
      const badgeW = 90;
      const badgeH = 26;
      ctx.beginPath();
      ctx.roundRect(width * 0.5 - badgeW * 0.5, height * 0.5 - 34, badgeW, badgeH, 6);
      ctx.fill();

      ctx.fillStyle = isVideo ? '#60a5fa' : '#a78bfa';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isVideo ? '▶ VIDEO' : '🖼 IMAGE', width * 0.5, height * 0.5 - 21);

      // 4. Sequence/Asset Identifier
      ctx.fillStyle = '#e4e4e7';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(assetId, width * 0.5, height * 0.5 + 14);

      // 5. Dimension & Fallback Note
      ctx.fillStyle = '#71717a';
      ctx.font = '11px monospace';
      ctx.fillText(`${width}x${height} • OFFLINE / PLACEHOLDER`, width * 0.5, height * 0.5 + 34);
    }

    this.placeholderCache.set(key, canvas);
    return canvas;
  }

  /**
   * Returns a cached canvas texture for a given asset ID or URL.
   */
  public getTextureCanvas(assetId: string, width = 640, height = 360): HTMLCanvasElement {
    const key = `${assetId}:${width}:${height}`;
    if (this.canvasCache.has(key)) {
      return this.canvasCache.get(key)!;
    }

    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return {} as any;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      this.renderProceduralSciFiAsset(ctx, assetId, width, height);
    }

    this.canvasCache.set(key, canvas);
    return canvas;
  }

  /**
   * Generates a data URL for timeline filmstrip thumbnail rendering.
   */
  public getThumbnailDataUrl(assetId: string, width = 120, height = 68): string {
    const key = `thumb:${assetId}:${width}:${height}`;
    if (this.dataUrlCache.has(key)) {
      return this.dataUrlCache.get(key)!;
    }

    const canvas = this.getTextureCanvas(assetId, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    this.dataUrlCache.set(key, dataUrl);
    return dataUrl;
  }

  /**
   * Procedural sci-fi renderer generating visually stunning assets for mock/demo IDs.
   */
  private renderProceduralSciFiAsset(
    ctx: CanvasRenderingContext2D,
    assetId: string,
    w: number,
    h: number
  ): void {
    const idLower = assetId.toLowerCase();

    // 1. Cosmic Space Nebula / Deep Space B-Roll
    if (idLower.includes('nebula') || idLower.includes('space') || idLower.includes('city') || idLower.includes('bg')) {
      const grad = ctx.createRadialGradient(w * 0.4, h * 0.5, 20, w * 0.5, h * 0.5, w * 0.7);
      grad.addColorStop(0, '#3b1d60');
      grad.addColorStop(0.4, '#151c38');
      grad.addColorStop(0.8, '#0b0f19');
      grad.addColorStop(1, '#05070d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Starfield
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 70; i++) {
        const sx = ((i * 137.5) % w);
        const sy = ((i * 243.7) % h);
        const r = (i % 3 === 0) ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cyan / Magenta nebula gas wisps
      const gasGrad = ctx.createLinearGradient(0, 0, w, h);
      gasGrad.addColorStop(0.2, 'rgba(0, 240, 255, 0.15)');
      gasGrad.addColorStop(0.5, 'rgba(255, 0, 128, 0.12)');
      gasGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gasGrad;
      ctx.fillRect(0, 0, w, h);
    }
    // 2. Cockpit / Cruiser HUD
    else if (idLower.includes('hud') || idLower.includes('cockpit') || idLower.includes('overlay')) {
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, w, h);

      // Holographic HUD reticle
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.28, 0, Math.PI * 2);
      ctx.stroke();

      // Pitch ladders
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1.5;
      for (let offset = -40; offset <= 40; offset += 20) {
        if (offset === 0) continue;
        ctx.beginPath();
        ctx.moveTo(w * 0.5 - 30, h * 0.5 + offset);
        ctx.lineTo(w * 0.5 + 30, h * 0.5 + offset);
        ctx.stroke();
      }

      // Corner technical telemetry
      ctx.fillStyle = '#00f0ff';
      ctx.font = '10px monospace';
      ctx.fillText('SYS.STATUS: ARMED', 12, 20);
      ctx.fillText('LOCK: TARGET-ALPHA', 12, 34);
      ctx.fillText('PWR: 98.4%', w - 80, 20);
    }
    // 3. Laser Cannon VFX
    else if (idLower.includes('laser') || idLower.includes('vfx') || idLower.includes('blast')) {
      ctx.fillStyle = '#05030a';
      ctx.fillRect(0, 0, w, h);

      // Laser energy beam
      const beamGrad = ctx.createLinearGradient(0, h * 0.5, w, h * 0.5);
      beamGrad.addColorStop(0, 'rgba(0, 255, 200, 0.1)');
      beamGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.9)');
      beamGrad.addColorStop(1, 'rgba(255, 255, 255, 1.0)');

      ctx.fillStyle = beamGrad;
      ctx.fillRect(0, h * 0.5 - 6, w, 12);

      // Core white heat line
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, h * 0.5 - 2, w, 4);
    }
    // Default Futuristic Abstract
    else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.strokeRect(4, 4, w - 8, h - 8);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '11px sans-serif';
      ctx.fillText(assetId.substring(0, 16), 10, h * 0.5 + 4);
    }

    // Timestamp & Watermark footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '9px monospace';
    ctx.fillText(`${w}x${h} | ${assetId}`, 8, h - 8);
  }

  /**
   * Caches static text rasterized onto an offscreen canvas to avoid per-frame layout recalculation.
   */
  public getRasterizedTextTexture(
    text: string,
    font = 'bold 32px sans-serif',
    fillColor = '#ffffff',
    strokeColor?: string,
    strokeWidth = 0
  ): HTMLCanvasElement {
    const key = `txt:${text}:${font}:${fillColor}:${strokeColor || ''}:${strokeWidth}`;
    const cached = this.canvasCache.get(key);
    if (cached) return cached;

    if (typeof document === 'undefined') {
      return null as any;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.font = font;
    const metrics = ctx.measureText(text);
    const w = Math.ceil(metrics.width) + 16;
    const h = 48; // Standard single-line height

    canvas.width = w;
    canvas.height = h;

    ctx.font = font;
    ctx.textBaseline = 'middle';

    if (strokeColor && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(text, 8, h * 0.5);
    }

    ctx.fillStyle = fillColor;
    ctx.fillText(text, 8, h * 0.5);

    this.canvasCache.set(key, canvas);
    return canvas;
  }

  /**
   * Caches static vector shape drawing to an offscreen canvas to avoid vector recalculations.
   */
  public getRasterizedShapeTexture(
    shapeKey: string,
    w: number,
    h: number,
    drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ): HTMLCanvasElement {
    const key = `shp:${shapeKey}:${w}:${h}`;
    const cached = this.canvasCache.get(key);
    if (cached) return cached;

    if (typeof document === 'undefined') {
      return null as any;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawFn(ctx, w, h);
    }

    this.canvasCache.set(key, canvas);
    return canvas;
  }
}

