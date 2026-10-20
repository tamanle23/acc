import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { ICanvasAdapter, ICanvasInstance, ICanvasContext2D } from '@acc/core-isomorphic';
import { wrapCanvasContext } from '@acc/core-isomorphic';

/**
 * NapiCanvasAdapter:
 * Native C++ Skia-based canvas adapter leveraging @napi-rs/canvas.
 * Server / Bun / Node only. Strictly encapsulated to avoid client bundle pollution.
 */
export class NapiCanvasAdapter implements ICanvasAdapter {
  public readonly name = 'node-napi-rs';
  public readonly environment = 'node' as const;

  public isSupported(): boolean {
    return (
      typeof process !== 'undefined' &&
      (Boolean(process.versions?.node) || Boolean((process.versions as any)?.bun))
    );
  }

  public createCanvas(width: number, height: number): ICanvasInstance {
    const raw = createCanvas(width, height);
    let cachedCtx: ICanvasContext2D | null = null;

    return {
      width,
      height,
      getContext: (contextId: '2d'): ICanvasContext2D => {
        if (!cachedCtx) {
          const rawCtx = raw.getContext(contextId);
          cachedCtx = wrapCanvasContext(rawCtx);
        }
        return cachedCtx;
      },
      toBuffer: (mimeType?: string): Buffer | Uint8Array => {
        if (mimeType === 'raw') {
          const ctx = cachedCtx || raw.getContext('2d');
          const imageData = ctx.getImageData(0, 0, width, height);
          return Buffer.from(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
        }
        const normalizedMime = !mimeType || mimeType === 'png' || mimeType === 'image/png'
          ? 'image/png'
          : mimeType === 'jpg' || mimeType === 'jpeg'
            ? 'image/jpeg'
            : mimeType.startsWith('image/')
              ? mimeType
              : `image/${mimeType}`;
        return raw.toBuffer(normalizedMime as any);
      },
      toDataURL: (mimeType?: string): string => {
        const type = mimeType && mimeType.startsWith('image/')
          ? mimeType
          : mimeType
            ? `image/${mimeType}`
            : 'image/png';
        return raw.toDataURL(type as any);
      },
      data: (): Uint8Array => {
        if (typeof (raw as any).data === 'function') {
          return (raw as any).data();
        }
        const ctx = cachedCtx || raw.getContext('2d');
        const imageData = ctx.getImageData(0, 0, width, height);
        return new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
      },
      getRawCanvas: () => raw,
    };
  }

  public async loadImage(source: string | Buffer | Uint8Array | Blob | File): Promise<any> {
    if (typeof source === 'string') {
      return loadImage(source);
    }
    if (source instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(source))) {
      const buf = Buffer.isBuffer(source) ? source : Buffer.from(source.buffer, source.byteOffset, source.byteLength);
      return loadImage(buf);
    }
    if (typeof (source as any).arrayBuffer === 'function') {
      const ab = await (source as Blob).arrayBuffer();
      return loadImage(Buffer.from(ab));
    }
    throw new Error(`[NapiCanvasAdapter] Unsupported image source type in Node: ${typeof source}`);
  }
}
