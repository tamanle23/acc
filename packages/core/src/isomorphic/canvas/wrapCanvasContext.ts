import type { ICanvasContext2D, ICanvasInstance } from './types';

/**
 * Automatically unwraps ICanvasInstance if passed as an image/canvas parameter
 * to drawImage or createPattern, fulfilling the Liskov Substitution Principle (LSP)
 * without per-call-site manual casting.
 */
export function wrapCanvasContext<T extends object>(rawCtx: T): ICanvasContext2D {
  if (!rawCtx || (rawCtx as any).__acc_unwrapped__) {
    return rawCtx as unknown as ICanvasContext2D;
  }

  const origDrawImage = (rawCtx as any).drawImage;
  const origCreatePattern = (rawCtx as any).createPattern;

  const unwrapSource = (source: any): any => {
    if (source && typeof source === 'object' && typeof (source as ICanvasInstance).getRawCanvas === 'function') {
      const unwrapped = (source as ICanvasInstance).getRawCanvas!();
      return unwrapped ?? source;
    }
    return source;
  };

  if (typeof origDrawImage === 'function') {
    (rawCtx as any).drawImage = function (image: any, ...args: any[]) {
      return origDrawImage.call(this, unwrapSource(image), ...args);
    };
  }

  if (typeof origCreatePattern === 'function') {
    (rawCtx as any).createPattern = function (image: any, repetition: any) {
      return origCreatePattern.call(this, unwrapSource(image), repetition);
    };
  }

  (rawCtx as any).__acc_unwrapped__ = true;
  return rawCtx as unknown as ICanvasContext2D;
}
