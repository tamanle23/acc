import { UniversalCanvasProvider } from './UniversalCanvasProvider';
import type { CanvasInstance } from './types';

/**
 * CanvasAssetLoader:
 * Isomorphic image loader and pixel processor supporting both Web
 * (Image, Blob, createImageBitmap) and Node/Bun (@napi-rs/canvas loadImage, Buffer).
 */
export class CanvasAssetLoader {
  /**
   * Loads an image from a file path, URL, Base64 data URL, Buffer, or Blob.
   */
  public static async loadImage(
    source: string | Buffer | Uint8Array | Blob | File
  ): Promise<any> {
    const env = UniversalCanvasProvider.detectEnvironment();

    if (env === 'node') {
      return this.loadNodeImage(source);
    }
    return this.loadWebImage(source);
  }

  /**
   * Extracts raw RGBA pixel bytes (Uint8Array) uniformly across any CanvasInstance.
   */
  public static extractRawPixels(canvas: CanvasInstance): Uint8Array {
    const buf = canvas.toBuffer('raw');
    if (buf instanceof Uint8Array) {
      return buf;
    }
    return new Uint8Array(buf);
  }

  private static async loadNodeImage(source: string | Buffer | Uint8Array | Blob | File): Promise<any> {
    let napi: any;
    try {
      napi = typeof require !== 'undefined' ? require('@napi-rs/canvas') : null;
    } catch {}

    if (!napi || typeof napi.loadImage !== 'function') {
      throw new Error('[CanvasAssetLoader] @napi-rs/canvas loadImage is not available in Node environment.');
    }

    if (typeof source === 'string') {
      return napi.loadImage(source);
    }

    if (source instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(source))) {
      const buf = Buffer.isBuffer(source) ? source : Buffer.from(source.buffer, source.byteOffset, source.byteLength);
      return napi.loadImage(buf);
    }

    if (typeof (source as any).arrayBuffer === 'function') {
      const ab = await (source as Blob).arrayBuffer();
      return napi.loadImage(Buffer.from(ab));
    }

    throw new Error(`[CanvasAssetLoader] Unsupported image source type in Node: ${typeof source}`);
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
        reject(new Error('[CanvasAssetLoader] Image constructor is not available in the current environment.'));
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
