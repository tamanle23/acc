import type { IContentCacheStrategy } from './types';
import { MemoryCacheStrategy } from './MemoryCacheStrategy';

/**
 * Universal Content Cache Registry:
 * Manages default and named cache strategies across isomorphic, client, and native runtimes.
 */
export class ContentCacheRegistry {
  private static defaultStrategy: IContentCacheStrategy = new MemoryCacheStrategy();
  private static strategies: Map<string, IContentCacheStrategy> = new Map([
    ['memory', ContentCacheRegistry.defaultStrategy],
  ]);

  public static register(strategy: IContentCacheStrategy, makeDefault: boolean = false): void {
    ContentCacheRegistry.strategies.set(strategy.id, strategy);
    if (makeDefault) {
      ContentCacheRegistry.defaultStrategy = strategy;
    }
  }

  public static setDefault(strategyOrId: IContentCacheStrategy | string): void {
    if (typeof strategyOrId === 'string') {
      const found = ContentCacheRegistry.strategies.get(strategyOrId);
      if (!found) {
        throw new Error(`[ContentCacheRegistry] Strategy "${strategyOrId}" is not registered.`);
      }
      ContentCacheRegistry.defaultStrategy = found;
    } else {
      ContentCacheRegistry.register(strategyOrId, true);
    }
  }

  public static get(id?: string): IContentCacheStrategy {
    if (!id) {
      return ContentCacheRegistry.defaultStrategy;
    }
    const found = ContentCacheRegistry.strategies.get(id);
    if (!found) {
      throw new Error(`[ContentCacheRegistry] Strategy "${id}" is not registered.`);
    }
    return found;
  }

  public static has(id: string): boolean {
    return ContentCacheRegistry.strategies.has(id);
  }

  public static reset(): void {
    ContentCacheRegistry.defaultStrategy = new MemoryCacheStrategy();
    ContentCacheRegistry.strategies.clear();
    ContentCacheRegistry.strategies.set('memory', ContentCacheRegistry.defaultStrategy);
  }
}
