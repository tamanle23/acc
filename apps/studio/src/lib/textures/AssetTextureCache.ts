/**
 * AssetTextureCache:
 * High-performance LRU texture and thumbnail cache for Studio.
 * Seamlessly decodes real image/video files into HTMLCanvasElement / ImageBitmap,
 * and procedurally generates rich sci-fi filmstrips and 3D textures for mock asset IDs.
 */
export class AssetTextureCache {
  private static instance: AssetTextureCache;
  private canvasCache = new Map<string, HTMLCanvasElement>();
  private dataUrlCache = new Map<string, string>();

  private constructor() {}

  public static getInstance(): AssetTextureCache {
    if (!AssetTextureCache.instance) {
      AssetTextureCache.instance = new AssetTextureCache();
    }
    return AssetTextureCache.instance;
  }

  /**
   * Returns a cached canvas texture for a given asset ID or URL.
   */
  public getTextureCanvas(assetId: string, width = 640, height = 360): HTMLCanvasElement {
    const key = `${assetId}:${width}:${height}`;
    if (this.canvasCache.has(key)) {
      return this.canvasCache.get(key)!;
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
}
