import type { CanvasAdapter, CanvasInstance, CanvasContext2D } from '../types';

let cachedNapi: any = null;

function resolveNapiCanvas(): any {
  if (cachedNapi) return cachedNapi;

  if (typeof process === 'undefined' || (!process.versions?.node && !process.versions?.bun)) {
    throw new Error('[NodeCanvasAdapter] Cannot load @napi-rs/canvas outside a Node/Bun runtime.');
  }

  try {
    if (typeof require !== 'undefined') {
      cachedNapi = require('@napi-rs/canvas');
      return cachedNapi;
    }
  } catch (err) {
    throw new Error(`[NodeCanvasAdapter] Failed to load @napi-rs/canvas: ${(err as Error).message}`);
  }

  throw new Error('[NodeCanvasAdapter] CommonJS require is unavailable to load @napi-rs/canvas.');
}

export class NodeCanvasAdapter implements CanvasAdapter {
  public readonly name = 'node-napi-rs';
  public readonly environment: 'node' = 'node';

  public isSupported(): boolean {
    if (typeof process === 'undefined' || (!process.versions?.node && !process.versions?.bun)) {
      return false;
    }
    try {
      const napi = resolveNapiCanvas();
      return typeof napi?.createCanvas === 'function';
    } catch {
      return false;
    }
  }

  public createCanvas(width: number, height: number): CanvasInstance {
    const napi = resolveNapiCanvas();
    const rawCanvas = napi.createCanvas(width, height);
    let cachedCtx: any = null;

    return {
      width,
      height,
      getRawCanvas: () => rawCanvas,
      getContext: (contextId: '2d'): CanvasContext2D => {
        if (!cachedCtx) {
          cachedCtx = rawCanvas.getContext(contextId);
        }
        return cachedCtx as unknown as CanvasContext2D;
      },
      toBuffer: (mimeType?: string): Buffer => {
        if (mimeType === 'raw' || !mimeType) {
          const ctx = cachedCtx || rawCanvas.getContext('2d');
          const imageData = ctx.getImageData(0, 0, width, height);
          return Buffer.from(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
        }
        const normalizedMime = mimeType.startsWith('image/')
          ? mimeType
          : mimeType === 'jpg'
            ? 'image/jpeg'
            : `image/${mimeType}`;
        return rawCanvas.toBuffer(normalizedMime as any);
      },
      toDataURL: (mimeType?: string): string => {
        const type = mimeType && mimeType.startsWith('image/') ? mimeType : mimeType ? `image/${mimeType}` : 'image/png';
        return rawCanvas.toDataURL(type as any);
      },
    };
  }
}
