import {
  CacheEntryMetadata,
  CacheNamespace,
  CachePayload,
  CacheSetOptions,
  ContentCacheStrategyId,
  EvictionPolicyOptions,
  type IContentCacheStrategy,
  type INamespacedCache,
} from './types';

/**
 * Deterministic namespace adapter that wraps any IContentCacheStrategy,
 * enforcing key prefix isolation, TTL expiration, lastAccessedAt tracking,
 * and LRU / FIFO eviction policies.
 */
export class NamespacedCacheAdapter implements INamespacedCache {
  public readonly namespace: string;
  private readonly strategy: IContentCacheStrategy;

  constructor(namespace: string, strategy: IContentCacheStrategy) {
    this.namespace = namespace;
    this.strategy = strategy;
  }

  public get strategyId(): string {
    return this.strategy.id;
  }

  private prefixKey(key: string): string {
    return `${this.namespace}/${key}`;
  }

  private unprefixKey(prefixedKey: string): string {
    const slashPrefix = `${this.namespace}/`;
    if (prefixedKey.startsWith(slashPrefix)) {
      return prefixedKey.slice(slashPrefix.length);
    }
    const colonPrefix = `${this.namespace}::`;
    if (prefixedKey.startsWith(colonPrefix)) {
      return prefixedKey.slice(colonPrefix.length);
    }
    return prefixedKey;
  }

  public async has(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const exists = await this.strategy.has(prefixedKey);
    if (!exists) return false;

    // Check expiration if metadata exists and strategy supports getMetadata
    if (typeof this.strategy.getMetadata === 'function') {
      const meta = await this.strategy.getMetadata(prefixedKey);
      if (meta?.expiresAt && Date.now() > meta.expiresAt) {
        await this.strategy.delete(prefixedKey);
        return false;
      }
    }
    return true;
  }

  public async get(key: string): Promise<Blob | null> {
    const prefixedKey = this.prefixKey(key);
    if (typeof this.strategy.getMetadata === 'function') {
      const meta = await this.strategy.getMetadata(prefixedKey);
      if (meta) {
        if (meta.expiresAt && Date.now() > meta.expiresAt) {
          await this.strategy.delete(prefixedKey);
          return null;
        }

        // Update lastAccessedAt for LRU tracking
        meta.lastAccessedAt = Date.now();
      }
    }

    return this.strategy.get(prefixedKey);
  }

  public async set(key: string, data: CachePayload, options?: CacheSetOptions): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    const now = Date.now();
    const expiresAt = options?.ttlMs ? now + options.ttlMs : undefined;

    const meta: Partial<CacheEntryMetadata> = {
      checksum: options?.checksum || `${prefixedKey}_${now}`,
      mimeType: options?.mimeType,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
      sizeBytes: options?.sizeBytes,
      namespace: this.namespace,
      metadata: options?.metadata,
    };

    await this.strategy.set(prefixedKey, data, meta);
  }

  public async createWritableStream(
    key: string,
    options?: CacheSetOptions
  ): Promise<WritableStream<Uint8Array>> {
    if (!this.strategy.createWritableStream) {
      throw new Error(`[NamespacedCacheAdapter] Strategy "${this.strategy.id}" does not support createWritableStream.`);
    }
    const prefixedKey = this.prefixKey(key);
    const now = Date.now();
    const expiresAt = options?.ttlMs ? now + options.ttlMs : undefined;

    const meta: Partial<CacheEntryMetadata> = {
      checksum: options?.checksum || `${prefixedKey}_${now}`,
      mimeType: options?.mimeType,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
      sizeBytes: options?.sizeBytes,
      namespace: this.namespace,
      metadata: options?.metadata,
    };

    return this.strategy.createWritableStream(prefixedKey, meta);
  }

  public async getMetadata(key: string): Promise<CacheEntryMetadata | null> {
    const prefixedKey = this.prefixKey(key);
    const meta = await this.strategy.getMetadata(prefixedKey);
    if (!meta) return null;

    if (meta.expiresAt && Date.now() > meta.expiresAt) {
      await this.strategy.delete(prefixedKey);
      return null;
    }
    return meta;
  }

  public async delete(key: string): Promise<boolean> {
    return this.strategy.delete(this.prefixKey(key));
  }

  public async getKeys(): Promise<string[]> {
    if (!this.strategy.getKeys) {
      return [];
    }
    const allKeys = await this.strategy.getKeys();
    const slashPrefix = `${this.namespace}/`;
    const colonPrefix = `${this.namespace}::`;
    return allKeys
      .filter((k) => k.startsWith(slashPrefix) || k.startsWith(colonPrefix))
      .map((k) => this.unprefixKey(k));
  }

  public async clear(): Promise<void> {
    const keys = await this.getKeys();
    for (const key of keys) {
      await this.strategy.delete(this.prefixKey(key));
    }
  }

  public async evictExpired(): Promise<number> {
    if (!this.strategy.getKeys) return 0;
    const allKeys = await this.strategy.getKeys();
    const slashPrefix = `${this.namespace}/`;
    const colonPrefix = `${this.namespace}::`;
    const namespaceKeys = allKeys.filter((k) => k.startsWith(slashPrefix) || k.startsWith(colonPrefix));

    let evictedCount = 0;
    const now = Date.now();

    for (const pKey of namespaceKeys) {
      const meta = await this.strategy.getMetadata(pKey);
      if (meta?.expiresAt && now > meta.expiresAt) {
        await this.strategy.delete(pKey);
        evictedCount++;
      }
    }
    return evictedCount;
  }

  public async evict(policy: EvictionPolicyOptions): Promise<number> {
    if (!this.strategy.getKeys) return 0;

    // First, clear expired entries
    let evictedCount = await this.evictExpired();

    const keys = await this.getKeys();
    if (keys.length === 0) return evictedCount;

    // Collect all metadata entries
    const entries: { key: string; pKey: string; meta: CacheEntryMetadata }[] = [];
    let totalSizeBytes = 0;

    for (const key of keys) {
      const pKey = this.prefixKey(key);
      const meta = await this.strategy.getMetadata(pKey);
      if (meta) {
        entries.push({ key, pKey, meta });
        totalSizeBytes += meta.sizeBytes || 0;
      }
    }

    // Sort entries according to policy
    if (policy.strategy === 'fifo') {
      entries.sort((a, b) => a.meta.createdAt - b.meta.createdAt);
    } else {
      // Default: LRU
      entries.sort((a, b) => (a.meta.lastAccessedAt || a.meta.createdAt) - (b.meta.lastAccessedAt || b.meta.createdAt));
    }

    const maxEntries = policy.maxEntries ?? Number.POSITIVE_INFINITY;
    const maxSizeBytes = policy.maxSizeBytes ?? Number.POSITIVE_INFINITY;

    for (const entry of entries) {
      const exceedsCount = entries.length - evictedCount > maxEntries;
      const exceedsSize = totalSizeBytes > maxSizeBytes;

      if (!exceedsCount && !exceedsSize) {
        break;
      }

      await this.strategy.delete(entry.pKey);
      totalSizeBytes -= entry.meta.sizeBytes || 0;
      evictedCount++;
    }

    return evictedCount;
  }
}

/**
 * Universal Content Cache Registry:
 * Manages cache strategies and provides strictly namespaced cache partitions.
 */
export class ContentCacheRegistry {
  private static defaultStrategy: IContentCacheStrategy;
  private static strategies: Map<ContentCacheStrategyId | string, IContentCacheStrategy> = new Map();
  private static namespacedInstances: Map<string, INamespacedCache> = new Map();

  public static register(strategy: IContentCacheStrategy, makeDefault: boolean = false): void {
    ContentCacheRegistry.strategies.set(strategy.id, strategy);
    if (makeDefault || !ContentCacheRegistry.defaultStrategy) {
      ContentCacheRegistry.defaultStrategy = strategy;
    }
  }

  public static setDefault(strategyOrId: IContentCacheStrategy | ContentCacheStrategyId | string): void {
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

  public static getStrategy(id?: ContentCacheStrategyId | string): IContentCacheStrategy {
    if (!id) {
      if (!ContentCacheRegistry.defaultStrategy) {
        throw new Error('[ContentCacheRegistry] No default cache strategy registered.');
      }
      return ContentCacheRegistry.defaultStrategy;
    }
    const found = ContentCacheRegistry.strategies.get(id);
    if (!found) {
      throw new Error(`[ContentCacheRegistry] Strategy "${id}" is not registered.`);
    }
    return found;
  }

  public static hasStrategy(id: ContentCacheStrategyId | string): boolean {
    return ContentCacheRegistry.strategies.has(id);
  }

  /**
   * Primary Entry Point:
   * Returns a strongly-isolated namespaced cache partition backed by the given or default strategy.
   */
  public static namespace(namespace: CacheNamespace | string, strategyId?: ContentCacheStrategyId | string): INamespacedCache {
    const strategy = ContentCacheRegistry.getStrategy(strategyId);
    const instanceKey = `${strategy.id}::${namespace}`;

    let namespaced = ContentCacheRegistry.namespacedInstances.get(instanceKey);
    if (!namespaced) {
      namespaced = new NamespacedCacheAdapter(namespace, strategy);
      ContentCacheRegistry.namespacedInstances.set(instanceKey, namespaced);
    }
    return namespaced;
  }

  /**
   * Evicts expired entries across all active namespaces.
   */
  public static async evictExpiredAll(): Promise<number> {
    let total = 0;
    for (const nsCache of ContentCacheRegistry.namespacedInstances.values()) {
      total += await nsCache.evictExpired();
    }
    return total;
  }

  public static reset(): void {
    ContentCacheRegistry.strategies.clear();
    ContentCacheRegistry.namespacedInstances.clear();
    ContentCacheRegistry.defaultStrategy = undefined as unknown as IContentCacheStrategy;
  }
}
