/**
 * AssetTextureCache:
 * High-performance LRU texture and thumbnail cache for Studio.
 * Seamlessly decodes real image/video files into HTMLCanvasElement / ImageBitmap,
 * and procedurally generates rich sci-fi filmstrips and 3D textures for mock asset IDs.
 */
import { ContentCacheRegistry, CacheNamespace, UniversalCanvasProvider } from '@acc/core-isomorphic';

export interface VisualAssetResult {
  source: CanvasImageSource | null;
  width: number;
  height: number;
  isReady: boolean;
  type: 'image' | 'video' | 'placeholder';
}

export class AssetTextureCache implements Disposable {
  private static instance: AssetTextureCache;
  private static directStorage = new Map<string, any>();
  private static objectUrls = new Map<string, string>();
  private hotImageLRU = new Map<string, { img: CanvasImageSource; url?: string; lastUsed: number }>();
  private hotVideoLRU = new Map<string, { video: HTMLVideoElement; lastUsed: number }>();
  private canvasCache = new Map<string, HTMLCanvasElement>();
  private dataUrlCache = new Map<string, string>();
  private placeholderCache = new Map<string, HTMLCanvasElement>();
  private inFlightResolutions = new Set<string>();
  private subscribers = new Set<() => void>();

  private readonly MAX_DIRECT_ENTRIES = 16;
  private readonly MAX_IMAGE_LRU = 8;
  private readonly MAX_VIDEO_LRU = 4;
  private readonly MAX_CANVAS_ENTRIES = 8;
  private readonly MAX_DATA_URL_ENTRIES = 16;
  private readonly MAX_PLACEHOLDER_ENTRIES = 4;

  private constructor() { }

  public static getInstance(): AssetTextureCache {
    if (!AssetTextureCache.instance) {
      AssetTextureCache.instance = new AssetTextureCache();
    }
    return AssetTextureCache.instance;
  }

  /**
   * Register or cache a visual texture directly (IPreviewTextureProvider contract).
   */
  public set(assetId: string, texture: any): void {
    if (AssetTextureCache.directStorage.size >= this.MAX_DIRECT_ENTRIES && !AssetTextureCache.directStorage.has(assetId)) {
      const oldestKey = AssetTextureCache.directStorage.keys().next().value;
      if (oldestKey !== undefined) {
        this.delete(oldestKey);
      }
    }
    AssetTextureCache.directStorage.set(assetId, texture);
  }

  /**
   * Retrieve a cached texture by asset ID (IPreviewTextureProvider contract).
   */
  public get(assetId: string): any | undefined {
    return AssetTextureCache.directStorage.get(assetId);
  }

  /**
   * Check if an asset is cached (IPreviewTextureProvider contract).
   */
  public has(assetId: string): boolean {
    return AssetTextureCache.directStorage.has(assetId);
  }

  /**
   * Delete a cached texture by asset ID and revoke any associated object URL.
   */
  public delete(assetId: string): boolean {
    const url = AssetTextureCache.objectUrls.get(assetId);
    if (url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(url);
      AssetTextureCache.objectUrls.delete(assetId);
    }
    const texture = AssetTextureCache.directStorage.get(assetId);
    if (texture && typeof texture.close === 'function') {
      try {
        texture.close();
      } catch { }
    }
    return AssetTextureCache.directStorage.delete(assetId);
  }

  /**
   * Load an image texture from a Blob.
   * Persists directly into ContentCacheRegistry and decodes into memory.
   */
  // public async loadBlob(assetId: string, blob: Blob): Promise<any> {
  //   // Persist to unified isomorphic ContentCacheRegistry
  //   try {
  //     const cache = ContentCacheRegistry.get();
  //     await cache.set(assetId, blob);
  //   } catch { }

  //   if (
  //     typeof window === 'undefined' ||
  //     typeof URL === 'undefined' ||
  //     typeof Image === 'undefined'
  //   ) {
  //     const mockImg = { width: 1920, height: 1080, _isMock: true };
  //     this.set(assetId, mockImg);
  //     return mockImg;
  //   }

  //   if (typeof createImageBitmap === 'function') {
  //     try {
  //       const bmp = await createImageBitmap(blob);
  //       this.set(assetId, bmp);
  //       this.setHotImage(assetId, bmp);
  //       this.notify();
  //       return bmp;
  //     } catch {
  //       // Fallback to Image element
  //     }
  //   }

  //   const objectUrl = URL.createObjectURL(blob);
  //   AssetTextureCache.objectUrls.set(assetId, objectUrl);

  //   return new Promise((resolve, reject) => {
  //     const img = new Image();
  //     img.crossOrigin = 'anonymous';
  //     img.onload = () => {
  //       this.set(assetId, img);
  //       this.setHotImage(assetId, img, objectUrl);
  //       this.notify();
  //       resolve(img);
  //     };
  //     img.onerror = (e) => {
  //       reject(new Error(`Failed to load texture blob for ${assetId}: ${e}`));
  //     };
  //     img.src = objectUrl;
  //   });
  // }

  /**
   * Clears all cached textures and revokes object URLs.
   */
  public clear(): void {
    this.dispose();
  }

  /**
   * Disposes of object URLs and media decoders to prevent memory leaks in long-running sessions.
   */
  public dispose(): void {
    if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
      for (const url of AssetTextureCache.objectUrls.values()) {
        URL.revokeObjectURL(url);
      }
    }

    for (const entry of this.hotImageLRU.values()) {
      if (entry.url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(entry.url);
      }
      if (typeof (entry.img as any).close === 'function') {
        try {
          (entry.img as any).close();
        } catch { }
      }
    }

    for (const entry of this.hotVideoLRU.values()) {
      try {
        entry.video.onloadeddata = null;
        entry.video.onerror = null;
        entry.video.pause();
        entry.video.removeAttribute('src');
        entry.video.load();
      } catch { }
    }

    for (const val of AssetTextureCache.directStorage.values()) {
      if (val && typeof val.close === 'function') {
        try {
          val.close();
        } catch { }
      }
    }

    AssetTextureCache.objectUrls.clear();
    AssetTextureCache.directStorage.clear();
    this.hotImageLRU.clear();
    this.hotVideoLRU.clear();
    this.canvasCache.clear();
    this.dataUrlCache.clear();
    this.placeholderCache.clear();
    this.inFlightResolutions.clear();
  }

  public [Symbol.dispose](): void {
    this.dispose();
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

  private setHotImage(key: string, img: CanvasImageSource, url?: string): void {
    if (this.hotImageLRU.size >= this.MAX_IMAGE_LRU && !this.hotImageLRU.has(key)) {
      const oldestKey = this.hotImageLRU.keys().next().value;
      if (oldestKey) {
        const old = this.hotImageLRU.get(oldestKey);
        if (old) {
          if (old.url && typeof URL !== 'undefined') {
            URL.revokeObjectURL(old.url);
          }
          if (typeof (old.img as any).close === 'function') {
            try {
              (old.img as any).close();
            } catch { }
          }
        }
        this.hotImageLRU.delete(oldestKey);
      }
    }
    this.hotImageLRU.set(key, { img, url, lastUsed: performance.now() });
  }

  private setHotVideo(key: string, video: HTMLVideoElement): void {
    if (this.hotVideoLRU.size >= this.MAX_VIDEO_LRU && !this.hotVideoLRU.has(key)) {
      const oldestKey = this.hotVideoLRU.keys().next().value;
      if (oldestKey) {
        const old = this.hotVideoLRU.get(oldestKey);
        if (old) {
          try {
            old.video.onloadeddata = null;
            old.video.onerror = null;
            old.video.pause();
            old.video.removeAttribute('src');
            old.video.load();
          } catch { }
        }
        this.hotVideoLRU.delete(oldestKey);
      }
    }
    this.hotVideoLRU.set(key, { video, lastUsed: performance.now() });
  }

  private async resolveImageAssetAsync(assetId: string, src: string): Promise<void> {
    try {
      let blob: Blob | null = null;
      try {
        const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
        blob = await cache.get(assetId);
        if (!blob && src) {
          blob = await cache.get(src);
        }
      } catch { }

      if (!blob && typeof fetch === 'function' && src && !src.startsWith('blob:')) {
        const res = await fetch(src);
        blob = await res.blob();
        try {
          const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
          cache.set(assetId, blob).catch(() => { });
        } catch { }
      }

      if (blob) {
        if (typeof createImageBitmap === 'function') {
          const bmp = await createImageBitmap(blob);
          this.setHotImage(src, bmp);
          this.notify();
          return;
        } else if (typeof Image !== 'undefined' && typeof URL !== 'undefined') {
          const objectUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            this.setHotImage(src, img, objectUrl);
            this.notify();
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
          };
          img.src = objectUrl;
          return;
        }
      }
    } catch (err) {
      console.warn(`[AssetTextureCache] Failed async resolve for ${assetId}:`, err);
    }
  }

  /**
   * Retrieves or asynchronously loads a visual asset (Image or Video decoder).
   * If not yet decoded or if URL fails, returns an isolated dark video placeholder canvas.
   */
  public getVisualAsset(
    assetId: string,
    src?: string,
    assetType: 'image' | 'video' = 'image',
    timeSec: number = 0
  ): VisualAssetResult {
    // 0. Direct Storage Check
    const direct = AssetTextureCache.directStorage.get(assetId);
    if (direct) {
      const w = direct.naturalWidth || direct.videoWidth || direct.width || 1920;
      const h = direct.naturalHeight || direct.videoHeight || direct.height || 1080;
      return {
        source: direct,
        width: w,
        height: h,
        isReady: true,
        type: assetType,
      };
    }

    // 1. If real URL provided and image type
    if (src && (assetType === 'image' || src.match(/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i))) {
      const cached = this.hotImageLRU.get(src);
      if (cached) {
        cached.lastUsed = performance.now();
        const img = cached.img as any;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w > 0 && h > 0) {
          return {
            source: cached.img,
            width: w,
            height: h,
            isReady: true,
            type: 'image',
          };
        }
      }

      if (!this.inFlightResolutions.has(src)) {
        this.inFlightResolutions.add(src);
        this.resolveImageAssetAsync(assetId, src).finally(() => {
          this.inFlightResolutions.delete(src);
        });
      }
    }

    // 2. If real URL provided and video/media type
    if (src && (assetType === 'video' || src.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i))) {
      let vEntry = this.hotVideoLRU.get(src);
      if (!vEntry) {
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          video.muted = true;
          video.playsInline = true;
          video.preload = 'auto';

          video.onloadeddata = () => {
            this.notify();
          };
          video.onerror = () => {
            console.warn(`[AssetTextureCache] Failed to load video: ${src}`);
          };
          video.src = src;

          this.setHotVideo(src, video);
          vEntry = this.hotVideoLRU.get(src);
        }
      }

      if (vEntry && vEntry.video.videoWidth > 0) {
        const targetTime = Math.max(0, timeSec);
        if (Math.abs(vEntry.video.currentTime - targetTime) > 0.05) {
          try {
            vEntry.video.currentTime = targetTime;
          } catch { }
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
    assetType: string = 'video',
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
      const isVideo = assetType === 'video';
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

    if (this.placeholderCache.size >= this.MAX_PLACEHOLDER_ENTRIES) {
      const oldestKey = this.placeholderCache.keys().next().value;
      if (oldestKey) this.placeholderCache.delete(oldestKey);
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
      this.renderAssetThumbnail(ctx, assetId, width, height);
    }

    if (this.canvasCache.size >= this.MAX_CANVAS_ENTRIES) {
      const oldestKey = this.canvasCache.keys().next().value;
      if (oldestKey) this.canvasCache.delete(oldestKey);
    }
    this.canvasCache.set(key, canvas);
    return canvas;
  }

  /**
   * Explicitly sets or pre-populates a thumbnail data URL in the cache.
   */
  public setThumbnailDataUrl(assetId: string, dataUrl: string, width = 120, height = 68): void {
    if (!assetId || !assetId.trim() || !dataUrl) return;
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const key = `thumb:${assetId}:${safeWidth}:${safeHeight}`;
    if (this.dataUrlCache.size >= this.MAX_DATA_URL_ENTRIES && !this.dataUrlCache.has(key)) {
      const oldestKey = this.dataUrlCache.keys().next().value;
      if (oldestKey) this.dataUrlCache.delete(oldestKey);
    }
    this.dataUrlCache.set(key, dataUrl);
  }

  /**
   * Generates a data URL for timeline filmstrip thumbnail rendering.
   * Utilizes UniversalCanvasProvider scratch pool to avoid DOM canvas allocation churn.
   */
  public getThumbnailDataUrl(assetId: string, width = 120, height = 68): string {
    if (!assetId || !assetId.trim()) {
      return '';
    }
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const key = `thumb:${assetId}:${safeWidth}:${safeHeight}`;
    if (this.dataUrlCache.has(key)) {
      return this.dataUrlCache.get(key)!;
    }

    let dataUrl = '';
    try {
      const scratch = UniversalCanvasProvider.acquireScratchCanvas(safeWidth, safeHeight);
      const raw = (scratch as any).getRawCanvas ? (scratch as any).getRawCanvas() : scratch;
      const ctx = raw.getContext ? raw.getContext('2d') : null;

      if (ctx) {
        this.renderAssetThumbnail(ctx, assetId, safeWidth, safeHeight);
        if (typeof raw.toDataURL === 'function') {
          dataUrl = raw.toDataURL('image/jpeg', 0.85);
        }
      }
      UniversalCanvasProvider.releaseScratchCanvas(scratch);
    } catch {
      // Fallback handled below
    }

    // If scratch canvas does not support toDataURL (e.g. OffscreenCanvas in browser) or failed, fallback to DOM canvas
    if (!dataUrl) {
      try {
        const canvas = this.getTextureCanvas(assetId, safeWidth, safeHeight);
        if (typeof canvas.toDataURL === 'function') {
          dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch {
        // Fallback gracefully
      }
    }

    if (dataUrl) {
      if (this.dataUrlCache.size >= this.MAX_DATA_URL_ENTRIES) {
        const oldestKey = this.dataUrlCache.keys().next().value;
        if (oldestKey) this.dataUrlCache.delete(oldestKey);
      }
      this.dataUrlCache.set(key, dataUrl);
    }
    return dataUrl;
  }

  /**
   * Renders a visual thumbnail for an asset:
   * Prioritizes real decoded visual assets (images, canvas, video frames, direct textures).
   * Falls back to procedural sci-fi asset generator for mock/demo IDs and offline states.
   */
  private renderAssetThumbnail(
    ctx: CanvasRenderingContext2D,
    assetId: string,
    w: number,
    h: number
  ): void {
    // 1. Check if real visual asset is available in direct storage or decoded LRU
    const direct = AssetTextureCache.directStorage.get(assetId);
    const hotImg = this.hotImageLRU.get(assetId);
    const hotVideo = this.hotVideoLRU.get(assetId);
    const visualSource =
      direct ||
      hotImg?.img ||
      (hotVideo?.video && hotVideo.video.readyState >= 2 ? hotVideo.video : null);

    if (visualSource) {
      try {
        ctx.drawImage(visualSource, 0, 0, w, h);
        return;
      } catch {
        // Fallback to procedural if drawing real asset fails (e.g. unready or detached)
      }
    }

    // 2. Procedural sci-fi renderer fallback for mock/demo IDs and offline placeholders
    this.renderProceduralSciFiAsset(ctx, assetId, w, h);
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

    if (this.canvasCache.size >= this.MAX_CANVAS_ENTRIES) {
      const oldestKey = this.canvasCache.keys().next().value;
      if (oldestKey) this.canvasCache.delete(oldestKey);
    }
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

    if (this.canvasCache.size >= this.MAX_CANVAS_ENTRIES) {
      const oldestKey = this.canvasCache.keys().next().value;
      if (oldestKey) this.canvasCache.delete(oldestKey);
    }
    this.canvasCache.set(key, canvas);
    return canvas;
  }
}

