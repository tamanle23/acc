import type { CanvasAdapter, CanvasInstance, CanvasContext2D } from '../types';

export class WebCanvasAdapter implements CanvasAdapter {
  public readonly name = 'web-canvas';
  public readonly environment: 'web' = 'web';

  public isSupported(): boolean {
    return (
      (typeof globalThis !== 'undefined' && typeof (globalThis as any).OffscreenCanvas !== 'undefined') ||
      (typeof document !== 'undefined' && typeof document.createElement === 'function')
    );
  }

  public createCanvas(width: number, height: number): CanvasInstance {
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

    let cachedCtx: any = null;

    return {
      width,
      height,
      getRawCanvas: () => rawCanvas,
      getContext: (contextId: '2d'): CanvasContext2D => {
        if (!cachedCtx) {
          cachedCtx = rawCanvas.getContext(contextId, { willReadFrequently: true }) || rawCanvas.getContext(contextId);
        }
        return cachedCtx as unknown as CanvasContext2D;
      },
      toBuffer: (mimeType?: string): Buffer | Uint8Array => {
        const ctx = cachedCtx || (rawCanvas.getContext('2d', { willReadFrequently: true }) || rawCanvas.getContext('2d'));
        if (!ctx) {
          throw new Error('[WebCanvasAdapter] Unable to obtain 2D rendering context for toBuffer()');
        }

        if (mimeType === 'raw' || !mimeType) {
          const imageData = ctx.getImageData(0, 0, width, height);
          const raw = imageData.data;
          if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
          }
          return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
        }

        // Base64 Data URL decoding fallback for png/jpeg if convertToBlob is sync-incompatible
        if (typeof rawCanvas.toDataURL === 'function') {
          const dataUrl = rawCanvas.toDataURL(mimeType.startsWith('image/') ? mimeType : `image/${mimeType}`);
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

        // Raw pixel buffer fallback if toDataURL is absent
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
    };
  }
}
