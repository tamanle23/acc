import { UniversalCanvasProvider } from './UniversalCanvasProvider';
import type { ICanvasInstance } from './types';

/**
 * CanvasAssetLoader:
 * Isomorphic image loader and pixel processor supporting both Web
 * (Image, Blob, createImageBitmap) and Node/Bun (via registered ICanvasAdapter).
 * Pure isomorphic TS with zero native C++ or direct Node imports.
 */
export class CanvasAssetLoader {
  /**
   * Loads an image from a file path, URL, Base64 data URL, Buffer, or Blob.
   */
  public static async loadImage(
    source: string | Buffer | Uint8Array | Blob | File
  ): Promise<any> {
    try {
      const adapter = UniversalCanvasProvider.getAdapter();
      if (adapter && typeof adapter.loadImage === 'function') {
        return await adapter.loadImage(source);
      }
    } catch {
      // If adapter fails or is not found, attempt web fallback
    }

    return this.loadWebImage(source);
  }

  /**
   * Extracts raw RGBA pixel bytes (Uint8Array) uniformly across any ICanvasInstance.
   */
  public static extractRawPixels(canvas: ICanvasInstance): Uint8Array {
    if (typeof canvas.data === 'function') {
      return canvas.data();
    }
    const buf = canvas.toBuffer('raw');
    if (buf instanceof Uint8Array) {
      return buf;
    }
    return new Uint8Array(buf);
  }

  private static async loadWebImage(source: string | Buffer | Uint8Array | Blob | File): Promise<any> {
    // 1. Blob or File
    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      if (typeof createImageBitmap === 'function') {
        return createImageBitmap(source);
      }
      const url = URL.createObjectURL(source);
      try {
        return await this.loadImageFromUrl(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    // 2. Raw bytes (Uint8Array or Buffer)
    if (source instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(source))) {
      if (typeof Blob !== 'undefined') {
        const blob = new Blob([source as any]);
        if (typeof createImageBitmap === 'function') {
          return createImageBitmap(blob);
        }
        const url = URL.createObjectURL(blob);
        try {
          return await this.loadImageFromUrl(url);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    }

    // 3. String URL or Data URL
    if (typeof source === 'string') {
      return this.loadImageFromUrl(source);
    }

    throw new Error(`[CanvasAssetLoader] Unsupported image source type in Web: ${typeof source}`);
  }

  private static loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (typeof Image === 'undefined') {
        reject(
          new Error(
            '[CanvasAssetLoader] HTML Image constructor unavailable in this environment. Ensure a canvas adapter is registered.'
          )
        );
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error(`[CanvasAssetLoader] Failed to load image from URL: ${err}`));
      img.src = url;
    });
  }
}
