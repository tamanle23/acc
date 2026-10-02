import { Logger } from './logger';

export interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number;
  mimeType?: string;
  [key: string]: any;
}

export class AssetContext {
  private assets: Map<string, Map<string, string>> = new Map();
  private metadata: Map<string, AssetMetadata> = new Map();

  /**
   * Registers a modified asset.
   * @param sceneId The unique ID of the scene (e.g., 'scene_1')
   * @param variant The type of variant (e.g., 'original', 'upscaled', 'depth')
   * @param path The absolute path to the generated asset
   * @param meta Optional metadata associated with this asset variant
   */
  public register(sceneId: string, variant: string, path: string, meta?: AssetMetadata): void {
    if (!this.assets.has(sceneId)) {
      this.assets.set(sceneId, new Map());
    }
    this.assets.get(sceneId)!.set(variant, path);

    if (meta) {
      const key = `${sceneId}:${variant}`;
      this.metadata.set(key, { ...this.metadata.get(key), ...meta });
    }

    Logger.debug('AssetContext', `Registered asset [${sceneId}] (${variant}): ${path}`);
  }

  /**
   * Retrieves the preferred asset variant if it exists, otherwise falls back.
   * @param sceneId The unique ID of the scene
   * @param preferredVariants Ordered array of preferred variants (e.g., ['upscaled', 'original'])
   * @returns The path to the best available asset, or undefined if none exist
   */
  public getPreferred(sceneId: string, preferredVariants: string[]): string | undefined {
    const sceneAssets = this.assets.get(sceneId);
    if (!sceneAssets) return undefined;

    for (const variant of preferredVariants) {
      if (sceneAssets.has(variant)) {
        return sceneAssets.get(variant);
      }
    }
    return undefined;
  }

  /**
   * Retrieves metadata for a specific scene variant.
   */
  public getMetadata(sceneId: string, variant: string): AssetMetadata | undefined {
    return this.metadata.get(`${sceneId}:${variant}`);
  }

  /**
   * Returns all registered variants for a given scene ID.
   */
  public getVariants(sceneId: string): Map<string, string> | undefined {
    return this.assets.get(sceneId);
  }
}

export interface ModelHandleEntry {
  modelHandle: any;
  lastUsed: number;
  estimatedMemoryMb: number;
}

/**
 * Flyweight AI Model & Shared Resource Registry for managing VRAM / memory models
 */
export class FlyweightModelRegistry {
  private static instance: FlyweightModelRegistry;
  protected loadedModels: Map<string, ModelHandleEntry> = new Map();
  protected maxVRAMBudgetMB: number = 8192; // 8GB default budget

  protected constructor() {}

  public static getInstance(): FlyweightModelRegistry {
    if (!FlyweightModelRegistry.instance) {
      FlyweightModelRegistry.instance = new FlyweightModelRegistry();
    }
    return FlyweightModelRegistry.instance;
  }

  public setVRAMBudgetMB(budgetMB: number): void {
    this.maxVRAMBudgetMB = budgetMB;
  }

  public getVRAMBudgetMB(): number {
    return this.maxVRAMBudgetMB;
  }

  public async acquireModel<T>(modelId: string, loader: () => Promise<T>, estimatedMemoryMb = 256): Promise<T> {
    if (this.loadedModels.has(modelId)) {
      const entry = this.loadedModels.get(modelId)!;
      entry.lastUsed = Date.now();
      Logger.debug('FlyweightRegistry', `Reusing cached model: ${modelId}`);
      return entry.modelHandle as T;
    }

    Logger.info('FlyweightRegistry', `Loading model into registry: ${modelId}`);
    const modelHandle = await loader();
    this.loadedModels.set(modelId, { modelHandle, lastUsed: Date.now(), estimatedMemoryMb });
    return modelHandle;
  }

  public async releaseInactiveModels(ttlMs: number = 60000): Promise<void> {
    const now = Date.now();
    for (const [modelId, entry] of this.loadedModels.entries()) {
      if (now - entry.lastUsed >= ttlMs) {
        Logger.info('FlyweightRegistry', `Unloading idle model: ${modelId}`);
        if (entry.modelHandle && typeof entry.modelHandle.dispose === 'function') {
          await entry.modelHandle.dispose();
        }
        this.loadedModels.delete(modelId);
      }
    }
  }

  public hasModel(modelId: string): boolean {
    return this.loadedModels.has(modelId);
  }

  public clearAll(): void {
    for (const [_, entry] of this.loadedModels.entries()) {
      if (entry.modelHandle && typeof entry.modelHandle.dispose === 'function') {
        entry.modelHandle.dispose();
      }
    }
    this.loadedModels.clear();
  }
}

/**
 * ModelHandleRegistry class providing Flyweight model handle management methods.
 */
export class ModelHandleRegistry extends FlyweightModelRegistry {
  private static handleInstance: ModelHandleRegistry;

  public static override getInstance(): ModelHandleRegistry {
    if (!ModelHandleRegistry.handleInstance) {
      ModelHandleRegistry.handleInstance = new ModelHandleRegistry();
    }
    return ModelHandleRegistry.handleInstance;
  }

  /**
   * Registers a pre-instantiated AI model handle directly.
   */
  public registerHandle<T>(handleId: string, handle: T, estimatedMemoryMb = 256): void {
    this.loadedModels.set(handleId, {
      modelHandle: handle,
      lastUsed: Date.now(),
      estimatedMemoryMb,
    });
    Logger.info('ModelHandleRegistry', `Registered handle [${handleId}] (${estimatedMemoryMb}MB)`);
  }

  /**
   * Retrieves an active model handle without triggering a loader.
   */
  public getHandle<T>(handleId: string): T | undefined {
    const entry = this.loadedModels.get(handleId);
    if (!entry) return undefined;
    entry.lastUsed = Date.now();
    return entry.modelHandle as T;
  }

  /**
   * Disposes and unloads a specific model handle from memory.
   */
  public async releaseHandle(handleId: string): Promise<boolean> {
    const entry = this.loadedModels.get(handleId);
    if (!entry) return false;

    if (entry.modelHandle && typeof entry.modelHandle.dispose === 'function') {
      await entry.modelHandle.dispose();
    }
    this.loadedModels.delete(handleId);
    Logger.info('ModelHandleRegistry', `Released handle [${handleId}]`);
    return true;
  }

  /**
   * Returns a list of all active model handle IDs currently in memory.
   */
  public getActiveHandles(): string[] {
    return Array.from(this.loadedModels.keys());
  }

  /**
   * Calculates total estimated memory usage of all cached AI model handles in MB.
   */
  public getTotalMemoryUsageMB(): number {
    let total = 0;
    for (const entry of this.loadedModels.values()) {
      total += entry.estimatedMemoryMb || 0;
    }
    return total;
  }

  /**
   * Evicts the oldest (LRU) inactive model handle to free memory.
   */
  public async evictLowestPriorityHandle(): Promise<boolean> {
    if (this.loadedModels.size === 0) return false;

    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.loadedModels.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestId = id;
      }
    }

    if (oldestId) {
      return await this.releaseHandle(oldestId);
    }
    return false;
  }
}
