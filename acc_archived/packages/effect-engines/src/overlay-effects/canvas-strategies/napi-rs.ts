import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import type { CanvasAdapter, CanvasInstance, CanvasContext2D } from './base';

export class NapiRsCanvasAdapter implements CanvasAdapter {
  private wrapperToOriginal = new WeakMap<CanvasInstance, any>();

  createCanvas(width: number, height: number): CanvasInstance {
    const canvas = UniversalCanvasProvider.createCanvas(width, height, 'node');
    const instance: CanvasInstance = {
      width,
      height,
      getRawCanvas: () => (canvas.getRawCanvas ? canvas.getRawCanvas() : canvas),
      getContext(contextId: '2d'): CanvasContext2D {
        return canvas.getContext(contextId) as unknown as CanvasContext2D;
      },
      toBuffer(mimeType?: string): Buffer {
        const buf = canvas.toBuffer(mimeType);
        if (Buffer.isBuffer(buf)) {
          return buf;
        }
        return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
      },
    };
    this.wrapperToOriginal.set(instance, canvas);
    return instance;
  }

  acquireScratchCanvas(width: number, height: number): CanvasInstance {
    const canvas = UniversalCanvasProvider.acquireScratchCanvas(width, height, 'node');
    const instance: CanvasInstance = {
      width,
      height,
      getRawCanvas: () => (canvas.getRawCanvas ? canvas.getRawCanvas() : canvas),
      getContext(contextId: '2d'): CanvasContext2D {
        return canvas.getContext(contextId) as unknown as CanvasContext2D;
      },
      toBuffer(mimeType?: string): Buffer {
        const buf = canvas.toBuffer(mimeType);
        if (Buffer.isBuffer(buf)) {
          return buf;
        }
        return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
      },
    };
    this.wrapperToOriginal.set(instance, canvas);
    return instance;
  }

  releaseScratchCanvas(canvas: CanvasInstance): void {
    const orig = this.wrapperToOriginal.get(canvas) || (canvas.getRawCanvas ? canvas.getRawCanvas() : canvas);
    UniversalCanvasProvider.releaseScratchCanvas(orig);
  }
}
