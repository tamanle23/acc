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

  const isDetachedOrInvalid = (source: any): boolean => {
    if (!source) return true;
    if (typeof source === 'object') {
      // Detached ImageBitmap or zero-dimension canvas/image
      if (source.width === 0 || source.height === 0) return true;
      if (typeof source.displayWidth === 'number' && source.displayWidth === 0) return true;
    }
    return false;
  };

  if (typeof origDrawImage === 'function') {
    (rawCtx as any).drawImage = function (image: any, ...args: any[]) {
      const unwrapped = unwrapSource(image);
      if (isDetachedOrInvalid(unwrapped)) {
        return;
      }
      try {
        return origDrawImage.call(this, unwrapped, ...args);
      } catch (err: any) {
        // Defensive: prevent detached buffer or closed resource error from crashing render loop
        if (
          err?.name === 'InvalidStateError' ||
          err?.message?.includes('detached') ||
          err?.message?.includes('closed')
        ) {
          return;
        }
        throw err;
      }
    };
  }

  if (typeof origCreatePattern === 'function') {
    (rawCtx as any).createPattern = function (image: any, repetition: any) {
      const unwrapped = unwrapSource(image);
      if (isDetachedOrInvalid(unwrapped)) {
        return null;
      }
      try {
        return origCreatePattern.call(this, unwrapped, repetition);
      } catch (err: any) {
        if (
          err?.name === 'InvalidStateError' ||
          err?.message?.includes('detached') ||
          err?.message?.includes('closed')
        ) {
          return null;
        }
        throw err;
      }
    };
  }

  (rawCtx as any).__acc_unwrapped__ = true;
  return rawCtx as unknown as ICanvasContext2D;
}
