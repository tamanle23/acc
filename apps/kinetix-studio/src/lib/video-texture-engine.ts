// ============================================================================
// KINETIX STUDIO v5.1 - CANVAS2D HIGH-PERFORMANCE VIDEO TEXTURE ENGINE
// Synchronously provides HTMLVideoElement frame references for RAF Canvas2D loops,
// frame-accurate seeking for offline video export, and memory cleanup.
// ============================================================================

export class VideoTextureEngine {
  private static instance: VideoTextureEngine | null = null;
  private videoCache = new Map<string, HTMLVideoElement>();
  private activeUrl: string | null = null;
  private isMuted = true;

  public static getInstance(): VideoTextureEngine {
    if (!VideoTextureEngine.instance) {
      VideoTextureEngine.instance = new VideoTextureEngine();
    }
    return VideoTextureEngine.instance;
  }

  /**
   * Preloads a video stream and prepares it for Canvas2D playback.
   */
  public async preloadVideo(url: string): Promise<HTMLVideoElement | null> {
    if (typeof document === 'undefined') return null;

    if (this.videoCache.has(url)) {
      const existing = this.videoCache.get(url)!;
      if (existing.readyState >= 2) {
        return existing;
      }
    }

    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = this.isMuted;
        video.loop = true;
        video.playsInline = true;
        video.autoplay = true;
        video.preload = 'auto';

        const onReady = () => {
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('error', onError);
          this.videoCache.set(url, video);
          // Start playback loop
          video.play().catch(() => {
            // Autoplay might need user interaction; video still draws at readyState >= 2
          });
          resolve(video);
        };

        const onError = (e: Event) => {
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('error', onError);
          console.warn('[VideoTextureEngine] Failed loading video:', url, e);
          resolve(null);
        };

        video.addEventListener('loadeddata', onReady);
        video.addEventListener('error', onError);

        video.src = url;
        video.load();
      } catch (err) {
        console.warn('[VideoTextureEngine] Initialization error:', err);
        resolve(null);
      }
    });
  }

  /**
   * Sets the active background video URL and starts playback.
   */
  public async setActiveVideo(url: string | null): Promise<void> {
    if (this.activeUrl === url) return;

    // Pause previously active video
    if (this.activeUrl && this.videoCache.has(this.activeUrl)) {
      const prev = this.videoCache.get(this.activeUrl)!;
      prev.pause();
    }

    this.activeUrl = url;

    if (url) {
      const video = await this.preloadVideo(url);
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    }
  }

  /**
   * Synchronous accessor for the 60fps Canvas2D render loop.
   * Guarantees zero async frame drops.
   */
  public getVideoFrame(url: string | null = this.activeUrl): HTMLVideoElement | null {
    if (!url || typeof document === 'undefined') return null;
    const video = this.videoCache.get(url);
    if (video && video.readyState >= 2) {
      return video;
    }
    return null;
  }

  /**
   * Frame-accurate deterministic seek for offline MP4/WebM video export.
   */
  public async seekToTime(timeSec: number, url: string | null = this.activeUrl): Promise<void> {
    const video = url ? this.videoCache.get(url) : null;
    if (!video || !Number.isFinite(timeSec)) return;

    return new Promise((resolve) => {
      const duration = video.duration || 10;
      const targetTime = timeSec % duration;

      // If already close, resolve immediately
      if (Math.abs(video.currentTime - targetTime) < 0.016) {
        resolve();
        return;
      }

      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };

      video.addEventListener('seeked', onSeeked);
      video.currentTime = targetTime;
    });
  }

  /**
   * Deterministically seeks to target second and returns the video element reference.
   */
  public async seekVideoFrame(
    url: string | null = this.activeUrl,
    targetTimeSec = 0
  ): Promise<HTMLVideoElement | null> {
    await this.seekToTime(targetTimeSec, url);
    return this.getVideoFrame(url);
  }

  /**
   * Disposes all video elements and frees browser memory.
   */
  public clear(): void {
    this.videoCache.forEach((video) => {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore cleanup error
      }
    });
    this.videoCache.clear();
    this.activeUrl = null;
  }

  [Symbol.dispose](): void {
    this.clear();
  }
}

export const videoTextureEngine = VideoTextureEngine.getInstance();
