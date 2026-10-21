import type { AssetMetadata, IAssetMetadataProber } from '@acc/ir';

/**
 * BrowserAssetMetadataProber:
 * Client-side implementation of IAssetMetadataProber for apps/studio.
 * Uses standard HTML5 Image, Audio, and Video elements to probe media duration and dimensions
 * with zero Node/Bun dependency. Includes in-memory caching.
 */
export class BrowserAssetMetadataProber implements IAssetMetadataProber {
  private cache = new Map<string, AssetMetadata>();

  public async probe(
    assetId: string,
    src: string,
    type: string,
    fps: number = 30
  ): Promise<AssetMetadata> {
    const cacheKey = `${assetId}:${src}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Default fallbacks in case of headless or immediate failure
    let durationSeconds = 5.0;
    let width: number | undefined = undefined;
    let height: number | undefined = undefined;

    let hasAudio: boolean | undefined = undefined;

    // Check if running in real DOM environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        if (type === 'audio' || src.endsWith('.wav') || src.endsWith('.mp3')) {
          durationSeconds = await this.probeAudioElement(src);
          hasAudio = true;
        } else if (type === 'media' || src.endsWith('.mp4') || src.endsWith('.webm')) {
          const videoMeta = await this.probeVideoElement(src);
          durationSeconds = videoMeta.duration;
          width = videoMeta.width;
          height = videoMeta.height;
          hasAudio = videoMeta.hasAudio;
        } else if (type === 'image' || src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.webp')) {
          const imgMeta = await this.probeImageElement(src);
          width = imgMeta.width;
          height = imgMeta.height;
          durationSeconds = 5.0; // Images default to 5.0s on NLE timeline
          hasAudio = false;
        }
      } catch (err) {
        console.warn(`[BrowserAssetMetadataProber] Probe fallback for ${src}:`, err);
      }
    }

    const durationFrames = Math.max(1, Math.round(durationSeconds * fps));
    const meta: AssetMetadata = {
      assetId,
      src,
      type,
      durationSeconds,
      durationFrames,
      width,
      height,
      hasAudio,
    };

    this.cache.set(cacheKey, meta);
    return meta;
  }

  private probeAudioElement(src: string): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      const timer = setTimeout(() => {
        resolve(5.0); // 3s timeout fallback
      }, 3000);

      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 5.0);
      };

      audio.onerror = () => {
        clearTimeout(timer);
        resolve(5.0);
      };

      audio.src = src;
    });
  }

  private probeVideoElement(src: string): Promise<{ duration: number; width: number; height: number; hasAudio: boolean }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const timer = setTimeout(() => {
        resolve({ duration: 5.0, width: 1920, height: 1080, hasAudio: true });
      }, 3000);

      video.onloadedmetadata = () => {
        clearTimeout(timer);
        // Detect audio stream presence
        let hasAudio = true;
        const vAny = video as any;
        if (typeof vAny.mozHasAudio !== 'undefined') {
          hasAudio = Boolean(vAny.mozHasAudio);
        } else if (vAny.audioTracks && typeof vAny.audioTracks.length === 'number') {
          hasAudio = vAny.audioTracks.length > 0;
        } else if (typeof vAny.webkitAudioDecodedByteCount !== 'undefined') {
          hasAudio = vAny.webkitAudioDecodedByteCount >= 0;
        }

        resolve({
          duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5.0,
          width: video.videoWidth || 1920,
          height: video.videoHeight || 1080,
          hasAudio,
        });
      };

      video.onerror = () => {
        clearTimeout(timer);
        resolve({ duration: 5.0, width: 1920, height: 1080, hasAudio: false });
      };

      video.src = src;
    });
  }

  private probeImageElement(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        resolve({ width: 1920, height: 1080 });
      }, 3000);

      img.onload = () => {
        clearTimeout(timer);
        resolve({ width: img.naturalWidth || 1920, height: img.naturalHeight || 1080 });
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve({ width: 1920, height: 1080 });
      };

      img.src = src;
    });
  }
}
