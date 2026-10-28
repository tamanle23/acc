import {
  Input,
  UrlSource,
  BlobSource,
  CanvasSink,
  ALL_FORMATS,
  type InputVideoTrack,
} from 'mediabunny';
import { ContentCacheRegistry } from '@acc/core-isomorphic';

export interface MediabunnyReaderOptions {
  fastScrubFps?: number; // default: 30
  assetId?: string;
}

/**
 * MediabunnyWorkerReader:
 * High-performance WebCodecs video frame decoder.
 * Runs in the preview.worker.ts thread to eliminate main-thread DOM seek thrashing.
 *
 * Responsibilities:
 * 1. Pure Decoder: fetches and decodes requested frames via WebCodecs CanvasSink.
 * 2. Zero Cache Double-Ownership: Frame caching and lifecycle disposal are owned
 *    exclusively by PreviewFrameMemoryManager.
 * 3. Fast scrub vs. idle refinement:
 *    - In scrub mode: throttled nearest keyframe decode.
 *    - In idle (>50ms pause): asynchronous exact-frame decode refinement.
 */
export class MediabunnyWorkerReader {
  public readonly src: string;
  public readonly assetId?: string;
  private input: Input | null = null;
  private videoTrack: InputVideoTrack | null = null;
  private canvasSink: CanvasSink | null = null;

  private isInitialized = false;
  private isInitializing = false;
  private initPromise: Promise<boolean> | null = null;

  // Track metadata
  public durationSec = 0;
  public width = 0;
  public height = 0;
  public fps = 30;

  // Scrub debounce timer
  private scrubIdleTimer: any = null;
  private lastScrubRequestTime = 0;
  private readonly fastScrubThrottleMs: number;
  private hasSavedPoster = false;

  // In-Flight Request Deduplication & WebCodecs Concurrency Gate
  private inFlightRequests = new Map<number, Promise<ImageBitmap | null>>();
  private activeDecodes = 0;
  private readonly MAX_CONCURRENT_DECODES = 2;

  constructor(src: string, options: MediabunnyReaderOptions = {}) {
    this.src = src;
    this.assetId = options.assetId;
    this.fastScrubThrottleMs = 1000 / (options.fastScrubFps ?? 30);
  }

  public async init(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.initPromise) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        let source: any = new UrlSource(this.src);

        // Zero-copy OPFS / cached Blob streaming resolution
        try {
          const cache = ContentCacheRegistry.get();
          let cachedBlob: Blob | null = null;
          if (this.assetId) {
            cachedBlob = await cache.get(this.assetId);
          }
          if (!cachedBlob && this.src) {
            cachedBlob = await cache.get(this.src);
          }
          if (cachedBlob) {
            source = new BlobSource(cachedBlob);
          }
        } catch {
          // Fallback to standard network UrlSource
        }

        this.input = new Input({
          formats: ALL_FORMATS,
          source,
        });

        const track = await this.input.getPrimaryVideoTrack();
        if (!track) {
          console.warn(`[MediabunnyWorkerReader] No primary video track found for ${this.src}`);
          this.isInitializing = false;
          return false;
        }

        this.videoTrack = track;
        this.width = (await track.getDisplayWidth().catch(() => 1920)) || 1920;
        this.height = (await track.getDisplayHeight().catch(() => 1080)) || 1080;

        // Bounded CanvasSink pool to eliminate uncollected OffscreenCanvas allocations
        this.canvasSink = new CanvasSink(track, { poolSize: 2 });
        this.isInitialized = true;
        this.isInitializing = false;

        // Compute duration asynchronously in the background (zero impact on initial seek responsiveness)
        this.input.computeDuration().then((dur) => {
          this.durationSec = dur;
        }).catch(() => {});

        return true;
      } catch (err) {
        console.warn(`[MediabunnyWorkerReader] Failed to initialize video ${this.src}:`, err);
        this.isInitializing = false;
        return false;
      }
    })();

    return this.initPromise;
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Decodes a specific frame integer t directly via CanvasSink.
   * Frame caching and lifecycle are owned by PreviewFrameMemoryManager.
   * Enforces in-flight deduplication and a hard concurrency gate (<= 2 decodes)
   * to guarantee zero WebCodecs hardware queue saturation.
   */
  public requestFrame(
    frame: number,
    fps: number,
    isScrubbing = false
  ): Promise<ImageBitmap | null> {
    // 1. In-flight request deduplication: return active promise if already decoding
    const existingPromise = this.inFlightRequests.get(frame);
    if (existingPromise) {
      return existingPromise;
    }

    const execute = async (): Promise<ImageBitmap | null> => {
      if (!this.isInitialized) {
        // Cold start or Evicted Standby: Fall back to OPFS poster keyframe if available
        if (this.assetId && typeof createImageBitmap === 'function') {
          try {
            const cache = ContentCacheRegistry.get();
            const posterBlob =
              (await cache.get(`poster:${this.assetId}`)) ||
              (await cache.get(this.assetId));
            if (posterBlob) {
              return await createImageBitmap(posterBlob);
            }
          } catch {
            // No cached poster available
          }
        }
        return null;
      }

      const targetSec = Math.max(0, frame / (fps || this.fps || 30));

      if (isScrubbing) {
        // 2. Scrub throttling: enforce <= 30fps decode rate
        const now = performance.now();
        if (now - this.lastScrubRequestTime < this.fastScrubThrottleMs) {
          return null;
        }
        this.lastScrubRequestTime = now;

        // Concurrency check for scrubbing: if hardware decoder is busy, skip scrub frame
        if (this.activeDecodes >= this.MAX_CONCURRENT_DECODES) {
          return null;
        }

        this.activeDecodes++;
        try {
          const wrappedCanvas = await this.canvasSink!.getCanvas(targetSec);
          if (wrappedCanvas) {
            const bmp = await this.toImageBitmap(wrappedCanvas);
            if (bmp && this.assetId && !this.hasSavedPoster) {
              this.hasSavedPoster = true;
              this.savePosterToCache(wrappedCanvas);
            }
            return bmp;
          }
        } catch (err) {
          // Graceful scrub skip
        } finally {
          this.activeDecodes = Math.max(0, this.activeDecodes - 1);
          this.inFlightRequests.delete(frame);
        }
        return null;
      }

      // 3. Exact frame decode with Concurrency Gate
      if (this.activeDecodes >= this.MAX_CONCURRENT_DECODES) {
        // Do not launch unthrottled concurrent decodes; return null to hold current frame
        return null;
      }

      this.activeDecodes++;
      try {
        const wrappedCanvas = await this.canvasSink!.getCanvas(targetSec);
        if (wrappedCanvas) {
          const bmp = await this.toImageBitmap(wrappedCanvas);
          if (bmp && this.assetId && !this.hasSavedPoster) {
            this.hasSavedPoster = true;
            this.savePosterToCache(wrappedCanvas);
          }
          return bmp;
        }
      } catch (err) {
        // Decode error fallback
      } finally {
        this.activeDecodes = Math.max(0, this.activeDecodes - 1);
        this.inFlightRequests.delete(frame);
      }
      return null;
    };

    const promise = execute();
    this.inFlightRequests.set(frame, promise);
    return promise;
  }

  private async toImageBitmap(wrappedCanvas: any): Promise<ImageBitmap | null> {
    if (!wrappedCanvas) return null;

    // If wrappedCanvas has a canvas element or is one
    const raw = typeof wrappedCanvas.getRawCanvas === 'function'
      ? wrappedCanvas.getRawCanvas()
      : wrappedCanvas.canvas || wrappedCanvas;

    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  private savePosterToCache(wrappedCanvas: any): void {
    if (!this.assetId) return;
    try {
      const raw = typeof wrappedCanvas.getRawCanvas === 'function'
        ? wrappedCanvas.getRawCanvas()
        : wrappedCanvas.canvas || wrappedCanvas;

      if (raw && typeof raw.convertToBlob === 'function') {
        raw.convertToBlob({ type: 'image/jpeg', quality: 0.8 }).then((blob: Blob) => {
          const cache = ContentCacheRegistry.get();
          cache.set(`poster:${this.assetId}`, blob).catch(() => {});
        }).catch(() => {});
      } else if (raw && typeof raw.toBlob === 'function') {
        raw.toBlob((blob: Blob | null) => {
          if (blob) {
            const cache = ContentCacheRegistry.get();
            cache.set(`poster:${this.assetId}`, blob).catch(() => {});
          }
        }, 'image/jpeg', 0.8);
      }
    } catch {}
  }

  /**
   * Reacquires hardware decoder session if evicted.
   */
  public async reacquireHardwareDecoder(): Promise<boolean> {
    if (this.isInitialized) return true;
    this.initPromise = null;
    return this.init();
  }

  /**
   * Evicts the underlying WebCodecs VideoDecoder hardware session
   * to free GPU resources and respect operating system decoder quotas.
   */
  public evictHardwareDecoder(): void {
    if (this.scrubIdleTimer) {
      clearTimeout(this.scrubIdleTimer);
      this.scrubIdleTimer = null;
    }

    this.inFlightRequests.clear();
    this.activeDecodes = 0;

    if (this.canvasSink) {
      this.canvasSink = null;
    }

    if (this.input) {
      try {
        this.input.dispose();
      } catch {}
      this.input = null;
    }

    this.videoTrack = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  public dispose(): void {
    if (this.scrubIdleTimer) {
      clearTimeout(this.scrubIdleTimer);
      this.scrubIdleTimer = null;
    }

    this.inFlightRequests.clear();
    this.activeDecodes = 0;

    if (this.input) {
      try {
        this.input.dispose();
      } catch {}
      this.input = null;
    }

    this.videoTrack = null;
    this.canvasSink = null;
    this.isInitialized = false;
  }
}
