import type { IMediaEngineStrategy, MediaEngineType } from './types';
import { MediaEngineError } from './types';

export class MediaEngineRegistry {
  private static strategies = new Map<MediaEngineType, IMediaEngineStrategy>();
  private static defaultEngine: MediaEngineType = 'bun-ffi';
  private static registeredLazyLoaders = new Map<MediaEngineType, () => Promise<IMediaEngineStrategy>>();

  public static register(strategy: IMediaEngineStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  public static registerLazy(id: MediaEngineType, loader: () => Promise<IMediaEngineStrategy>): void {
    this.registeredLazyLoaders.set(id, loader);
  }

  public static setDefaultEngine(type: MediaEngineType): void {
    this.defaultEngine = type;
  }

  public static getDefaultEngine(): MediaEngineType {
    return this.defaultEngine;
  }

  public static has(type: MediaEngineType): boolean {
    return this.strategies.has(type) || this.registeredLazyLoaders.has(type);
  }

  public static listAvailable(): MediaEngineType[] {
    const ids = new Set<MediaEngineType>([
      ...this.strategies.keys(),
      ...this.registeredLazyLoaders.keys(),
    ]);
    return Array.from(ids);
  }

  public static async getAsync(type?: MediaEngineType): Promise<IMediaEngineStrategy> {
    const selected = type || (process.env.ACC_MEDIA_ENGINE as MediaEngineType) || this.defaultEngine;

    let strategy = this.strategies.get(selected);
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

  public static get(type?: MediaEngineType): IMediaEngineStrategy {
    const selected = type || (process.env.ACC_MEDIA_ENGINE as MediaEngineType) || this.defaultEngine;
    const strategy = this.strategies.get(selected);

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
    this.defaultEngine = 'bun-ffi';
  }
}
