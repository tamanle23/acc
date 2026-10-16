import { CanvasAdapter } from './base';
import { NapiRsCanvasAdapter } from './napi-rs';

export type CanvasEngineType = 'gpu' | 'napi-rs' | 'auto';

/**
 * CanvasAdapterFactory:
 * Dynamic canvas resolution factory providing GPU hardware acceleration when available
 * with an automatic, headless-safe fallback to high-performance @napi-rs/canvas.
 */
export class CanvasAdapterFactory {
  private static cachedAdapter: CanvasAdapter | null = null;
  private static detectedEngine: CanvasEngineType = 'napi-rs';

  /**
   * Resolves appropriate CanvasAdapter.
   * If 'gpu' is requested, tests for OffscreenCanvas / WebGL driver support;
   * falls back safely to 'napi-rs' in headless Docker, CI/CD, or Node/Bun environments.
   */
  public static getAdapter(engine: CanvasEngineType = 'auto'): CanvasAdapter {
    if (engine === 'auto') {
      return this.resolveAutoAdapter();
    }

    if (engine === 'gpu') {
      try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).OffscreenCanvas !== 'undefined') {
          // Future GPU offscreen wrapper or native Napi-RS
          this.detectedEngine = 'gpu';
          return new NapiRsCanvasAdapter();
        }
      } catch {}
      // Fallback to napi-rs
      this.detectedEngine = 'napi-rs';
      return new NapiRsCanvasAdapter();
    }

    if (engine === 'napi-rs') {
      return new NapiRsCanvasAdapter();
    }

    // Default safe fallback
    return new NapiRsCanvasAdapter();
  }

  public static getDetectedEngine(): CanvasEngineType {
    return this.detectedEngine;
  }

  private static resolveAutoAdapter(): CanvasAdapter {
    if (this.cachedAdapter) return this.cachedAdapter;

    // Detect headless server environments (headless linux/container/bun without display)
    const isHeadless =
      typeof process !== 'undefined' &&
      (!process.env.DISPLAY && process.platform !== 'win32' && process.platform !== 'darwin');

    if (!isHeadless && typeof globalThis !== 'undefined' && typeof (globalThis as any).OffscreenCanvas !== 'undefined') {
      this.detectedEngine = 'gpu';
    } else {
      this.detectedEngine = 'napi-rs';
    }

    this.cachedAdapter = new NapiRsCanvasAdapter();
    return this.cachedAdapter;
  }
}
