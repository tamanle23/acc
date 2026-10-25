import { CanvasAdapter } from './base';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';

export type CanvasEngineType = 'gpu' | 'napi-rs' | 'web' | 'auto';

/**
 * CanvasAdapterFactory:
 * Unified canvas resolution factory routing dynamically to UniversalCanvasProvider.
 * Provides isomorphic execution across Web (OffscreenCanvas/HTMLCanvasElement) and Node (@napi-rs/canvas).
 */
export class CanvasAdapterFactory {
  /**
   * Resolves appropriate CanvasAdapter.
   */
  public static getAdapter(engine: CanvasEngineType = 'auto'): CanvasAdapter {
    if (engine === 'gpu' || engine === 'web') {
      return UniversalCanvasProvider.getAdapter('web') as unknown as CanvasAdapter;
    }
    if (engine === 'napi-rs') {
      return UniversalCanvasProvider.getAdapter('node') as unknown as CanvasAdapter;
    }
    return UniversalCanvasProvider.getAdapter('auto') as unknown as CanvasAdapter;
  }

  public static getDetectedEngine(): CanvasEngineType {
    const env = UniversalCanvasProvider.detectEnvironment();
    return env === 'web' ? 'gpu' : 'napi-rs';
  }
}
