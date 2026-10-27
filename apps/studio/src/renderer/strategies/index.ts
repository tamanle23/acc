import type { IPreviewRenderStrategy } from './IPreviewRenderStrategy';
import { WorkerRenderStrategy } from './WorkerRenderStrategy';
import { MainThreadRenderStrategy } from './MainThreadRenderStrategy';

export * from './IPreviewRenderStrategy';
export * from './WorkerRenderStrategy';
export * from './MainThreadRenderStrategy';

export interface StrategyFactoryOptions {
  preferMainThread?: boolean;
}

/**
 * Creates and auto-negotiates an appropriate IPreviewRenderStrategy.
 * Checks for OffscreenCanvas transfer support and Web Worker capability.
 * Gracefully falls back to MainThreadRenderStrategy.
 */
export function createPreviewRenderStrategy(
  options?: StrategyFactoryOptions
): IPreviewRenderStrategy {
  if (options?.preferMainThread) {
    return new MainThreadRenderStrategy();
  }

  const hasOffscreenSupport =
    typeof window !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function' &&
    typeof Worker !== 'undefined';

  if (hasOffscreenSupport) {
    return new WorkerRenderStrategy();
  }

  return new MainThreadRenderStrategy();
}
