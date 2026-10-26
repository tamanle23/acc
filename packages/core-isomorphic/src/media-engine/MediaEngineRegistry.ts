import type { IMediaEngineStrategy, MediaEngineType } from './types';
import { MediaEngineError } from './types';
import { PlatformDetector } from '../platform/PlatformDetector';

export class MediaEngineRegistry {
  private static strategies = new Map<MediaEngineType, IMediaEngineStrategy>();
  private static defaultEngine: MediaEngineType = PlatformDetector.resolveDefaultMediaEngine();
  private static registeredLazyLoaders = new Map<MediaEngineType, () => Promise<IMediaEngineStrategy>>();

  private static normalizeId(id: string): MediaEngineType {
    if (id === 'mediabunny') {
      const isWeb = typeof window !== 'undefined' || typeof document !== 'undefined';
      return isWeb ? 'mediabunny-client' : 'mediabunny-server';
    }
    return id as MediaEngineType;
  }

  public static register(strategy: IMediaEngineStrategy): void {
    this.strategies.set(strategy.id, strategy);
    // Support alias 'mediabunny' for convenience
    if (strategy.id === 'mediabunny-server' || strategy.id === 'mediabunny-client') {
      this.strategies.set('mediabunny' as any, strategy);
    }
  }

  public static registerLazy(id: MediaEngineType, loader: () => Promise<IMediaEngineStrategy>): void {
    const norm = this.normalizeId(id);
    this.registeredLazyLoaders.set(norm, loader);
  }

  public static setDefaultEngine(type: MediaEngineType): void {
    this.defaultEngine = this.normalizeId(type);
  }

  public static getDefaultEngine(): MediaEngineType {
    return this.defaultEngine;
  }

  public static has(type: string): boolean {
    const norm = this.normalizeId(type);
    return this.strategies.has(norm as any) || this.strategies.has(type as any) || this.registeredLazyLoaders.has(norm);
  }

  public static listAvailable(): MediaEngineType[] {
    const ids = new Set<MediaEngineType>([
      ...this.strategies.keys(),
      ...this.registeredLazyLoaders.keys(),
    ]);
    return Array.from(ids);
  }

  public static async getAsync(type?: string): Promise<IMediaEngineStrategy> {
    const rawSelected = type || (process.env.ACC_MEDIA_ENGINE as string) || this.defaultEngine;
    const selected = this.normalizeId(rawSelected);

    let strategy = this.strategies.get(selected) || this.strategies.get(rawSelected as any);
    if (!strategy && this.registeredLazyLoaders.has(selected)) {
      const loader = this.registeredLazyLoaders.get(selected)!;
      strategy = await loader();
      this.strategies.set(selected, strategy);
    }

    if (!strategy) {
      throw new MediaEngineError(
        selected,
        `Media engine strategy '${selected}' is not registered.`
      );
    }

    strategy.validatePrerequisites();
    return strategy;
  }

  public static get(type?: string): IMediaEngineStrategy {
    const rawSelected = type || (process.env.ACC_MEDIA_ENGINE as string) || this.defaultEngine;
    const selected = this.normalizeId(rawSelected);
    const strategy = this.strategies.get(selected) || this.strategies.get(rawSelected as any);

    if (!strategy) {
      throw new MediaEngineError(
        selected,
        `Media engine strategy '${selected}' is not synchronously loaded. Use getAsync('${selected}') or register it explicitly before access.`
      );
    }

    strategy.validatePrerequisites();
    return strategy;
  }

  public static reset(): void {
    this.strategies.clear();
    this.registeredLazyLoaders.clear();
    this.defaultEngine = PlatformDetector.resolveDefaultMediaEngine();
  }
}
