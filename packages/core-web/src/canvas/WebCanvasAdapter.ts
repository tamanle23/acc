import type { ICanvasAdapter, ICanvasInstance, ICanvasContext2D } from '@acc/core-isomorphic';
import { wrapCanvasContext, UniversalCanvasProvider } from '@acc/core-isomorphic';

/**
 * WebCanvasAdapter:
 * Browser/Worker canvas adapter leveraging OffscreenCanvas or HTMLCanvasElement.
 * Pure web runtime safe with zero C++ or Node.js native dependencies.
 */
export class WebCanvasAdapter implements ICanvasAdapter {
  public readonly name = 'web-canvas';
  public readonly environment = 'web' as const;

  public isSupported(): boolean {
    return (
      (typeof globalThis !== 'undefined' && typeof (globalThis as any).OffscreenCanvas !== 'undefined') ||
      (typeof document !== 'undefined' && typeof document.createElement === 'function')
    );
  }

  public createCanvas(width: number, height: number): ICanvasInstance {
    let rawCanvas: any;
    const hasOffscreen = typeof globalThis !== 'undefined' && typeof (globalThis as any).OffscreenCanvas !== 'undefined';

    if (hasOffscreen) {
      rawCanvas = new (globalThis as any).OffscreenCanvas(width, height);
    } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      rawCanvas = document.createElement('canvas');
      rawCanvas.width = width;
      rawCanvas.height = height;
    } else {
      throw new Error(
        '[WebCanvasAdapter] Neither OffscreenCanvas nor document.createElement("canvas") is available in the current environment.'
      );
    }

    let cachedCtx: ICanvasContext2D | null = null;

    return {
      width,
      height,
      getRawCanvas: () => rawCanvas,
      getContext: (contextId: '2d'): ICanvasContext2D => {
        if (!cachedCtx) {
          const rawCtx = rawCanvas.getContext(contextId, { willReadFrequently: true }) || rawCanvas.getContext(contextId);
          cachedCtx = wrapCanvasContext(rawCtx);
        }
        return cachedCtx;
      },
      toBuffer: (mimeType?: string): Buffer | Uint8Array => {
        const ctx = cachedCtx || (rawCanvas.getContext('2d', { willReadFrequently: true }) || rawCanvas.getContext('2d'));
        if (!ctx) {
          throw new Error('[WebCanvasAdapter] Unable to obtain 2D rendering context for toBuffer()');
        }

        if (mimeType === 'raw') {
          const imageData = ctx.getImageData(0, 0, width, height);
          const raw = imageData.data;
          if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
          }
          return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
        }

        const effectiveMime = !mimeType || mimeType === 'png' || mimeType === 'image/png'
          ? 'image/png'
          : mimeType === 'jpg' || mimeType === 'jpeg'
            ? 'image/jpeg'
            : mimeType.startsWith('image/')
              ? mimeType
              : `image/${mimeType}`;

        if (typeof rawCanvas.toDataURL === 'function') {
          const dataUrl = rawCanvas.toDataURL(effectiveMime);
          const base64Data = dataUrl.split(',')[1] || '';
          if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            return Buffer.from(base64Data, 'base64');
          }
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          return bytes;
        }

        const imageData = ctx.getImageData(0, 0, width, height);
        const raw = imageData.data;
        if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
          return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
        }
        return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      },
      toDataURL: (mimeType?: string): string => {
        const type = mimeType && mimeType.startsWith('image/') ? mimeType : mimeType ? `image/${mimeType}` : 'image/png';
        if (typeof rawCanvas.toDataURL === 'function') {
          return rawCanvas.toDataURL(type);
        }
        return '';
      },
      toBlob: async (mimeType?: string): Promise<Blob> => {
        const type = mimeType && mimeType.startsWith('image/') ? mimeType : mimeType ? `image/${mimeType}` : 'image/png';
        if (typeof rawCanvas.convertToBlob === 'function') {
          return rawCanvas.convertToBlob({ type });
        }
        if (typeof rawCanvas.toBlob === 'function') {
          return new Promise<Blob>((resolve, reject) => {
            rawCanvas.toBlob((b: Blob | null) => {
              if (b) resolve(b);
              else reject(new Error('[WebCanvasAdapter] toBlob returned null'));
            }, type);
          });
        }
        throw new Error('[WebCanvasAdapter] Canvas does not support convertToBlob or toBlob in this environment.');
      },
      data: (): Uint8Array => {
        const ctx = cachedCtx || (rawCanvas.getContext('2d', { willReadFrequently: true }) || rawCanvas.getContext('2d'));
        const imageData = ctx.getImageData(0, 0, width, height);
        return new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
      },
    };
  }

  public async loadImage(source: string | Buffer | Uint8Array | Blob | File): Promise<any> {
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

    if (typeof source === 'string') {
      return this.loadImageFromUrl(source);
    }

    throw new Error(`[WebCanvasAdapter] Unsupported image source type in Web: ${typeof source}`);
  }

  private loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (typeof Image === 'undefined') {
        reject(new Error('[WebCanvasAdapter] HTML Image constructor unavailable.'));
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error(`[WebCanvasAdapter] Failed to load image from URL: ${err}`));
      img.src = url;
    });
  }

  public acquireScratchCanvas(width: number, height: number): ICanvasInstance {
    return UniversalCanvasProvider.acquireScratchCanvas(width, height, 'web');
  }

  public releaseScratchCanvas(canvas: ICanvasInstance): void {
    UniversalCanvasProvider.releaseScratchCanvas(canvas);
  }
}
