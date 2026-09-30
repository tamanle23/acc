import { createCanvas, Canvas } from '@napi-rs/canvas';
import { CanvasAdapter, CanvasInstance, CanvasContext2D } from './base';

export class NapiRsCanvasAdapter implements CanvasAdapter {
  createCanvas(width: number, height: number): CanvasInstance {
    const canvas = createCanvas(width, height);
    return {
      width,
      height,
      getRawCanvas: () => canvas,
      getContext(contextId: '2d'): CanvasContext2D {
        const ctx = canvas.getContext(contextId);
        // Cast to our interface. @napi-rs/canvas context implements this and much more.
        return ctx as unknown as CanvasContext2D;
      },
      toBuffer(mimeType?: string): Buffer {
        if (mimeType === 'raw') {
          // In napi-rs/canvas, getting raw pixel data requires some gymnastics
          // but we can use toBuffer('raw') if supported, or extract it via getImageData.
          // Wait, napi-rs/canvas supports raw pixel buffer via canvas.data? No, it's `toBuffer('raw')`
          // Let's check napi-rs canvas docs. `canvas.toBuffer('raw')` returns BGRA or RGBA.
          // Actually, it's safer to use ctx.getImageData(0, 0, width, height).data which is Uint8ClampedArray
          const ctx = canvas.getContext('2d');
          const imageData = ctx.getImageData(0, 0, width, height);
          return Buffer.from(imageData.data.buffer);
        }
        // Fallback to png/jpeg if not 'raw', but we need raw for pipeline.
        return canvas.toBuffer(mimeType as any);
      }
    };
  }
}
