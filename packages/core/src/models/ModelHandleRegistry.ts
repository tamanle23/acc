import { FlyweightModelRegistry, type ModelHandleEntry } from '../AssetContext';
import { UniversalLogger as Logger } from '@acc/core-isomorphic';

export interface RefCountedModelEntry extends ModelHandleEntry {
  refCount: number;
}

/**
 * ModelHandleRegistry:
 * Enhanced VRAM & Native Model Registry featuring reference-counting locks
 * and Least-Recently-Used (LRU) model eviction to prevent memory leaks and
 * safeguard concurrently running chunk workers from mid-stream disposals.
 */
export class ModelHandleRegistry extends FlyweightModelRegistry {
  private static handleInstance: ModelHandleRegistry;
  protected override loadedModels: Map<string, RefCountedModelEntry> = new Map();

  public static override getInstance(): ModelHandleRegistry {
    if (!ModelHandleRegistry.handleInstance) {
      ModelHandleRegistry.handleInstance = new ModelHandleRegistry();
    }
    return ModelHandleRegistry.handleInstance;
  }

  /**
   * Registers a model handle with initial reference count of 0.
   */
  public registerHandle<T>(handleId: string, handle: T, estimatedMemoryMb = 256): void {
    this.loadedModels.set(handleId, {
      modelHandle: handle,
      lastUsed: Date.now(),
      estimatedMemoryMb,
      refCount: 0,
    });
    Logger.info('ModelHandleRegistry', `Registered handle [${handleId}] (${estimatedMemoryMb}MB)`);
  }

  /**
   * Acquires a reference lock on a model handle, incrementing its refCount.
   * Prevents LRU eviction while actively in use by a chunk render worker.
   */
  public acquireLock<T>(handleId: string): T | undefined {
    const entry = this.loadedModels.get(handleId);
    if (!entry) return undefined;
    entry.refCount = (entry.refCount || 0) + 1;
    entry.lastUsed = Date.now();
    Logger.debug('ModelHandleRegistry', `Acquired lock on [${handleId}] (refCount: ${entry.refCount})`);
    return entry.modelHandle as T;
  }

  /**
   * Releases a reference lock on a model handle, decrementing its refCount.
   */
  public releaseLock(handleId: string): number {
    const entry = this.loadedModels.get(handleId);
    if (!entry) return 0;
    entry.refCount = Math.max(0, (entry.refCount || 1) - 1);
    entry.lastUsed = Date.now();
    Logger.debug('ModelHandleRegistry', `Released lock on [${handleId}] (refCount: ${entry.refCount})`);
    return entry.refCount;
  }

  /**
   * Returns current reference count for a model handle.
   */
  public getRefCount(handleId: string): number {
    const entry = this.loadedModels.get(handleId);
    return entry ? (entry.refCount || 0) : 0;
  }

  /**
   * Retrieves an active model handle without altering lock count.
   */
  public getHandle<T>(handleId: string): T | undefined {
    const entry = this.loadedModels.get(handleId);
    if (!entry) return undefined;
    entry.lastUsed = Date.now();
    return entry.modelHandle as T;
  }

  /**
   * Disposes and unloads a specific model handle from memory.
   * If force is false, will refuse to unload if refCount > 0.
   */
  public async releaseHandle(handleId: string, force = false): Promise<boolean> {
    const entry = this.loadedModels.get(handleId);
    if (!entry) return false;

    if (!force && (entry.refCount || 0) > 0) {
      Logger.warn(
        'ModelHandleRegistry',
        `Cannot release locked handle [${handleId}] (active refCount: ${entry.refCount})`
      );
      return false;
    }

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
   * Evicts the Least-Recently-Used (LRU) UNLOCKED model handle to free memory.
   * Model handles with active refCount > 0 are strictly preserved.
   */
  public async evictLowestPriorityHandle(): Promise<boolean> {
    if (this.loadedModels.size === 0) return false;

    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.loadedModels.entries()) {
      // Never evict models with active reference locks
      if ((entry.refCount || 0) > 0) continue;

      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestId = id;
      }
    }

    if (oldestId) {
      Logger.info('ModelHandleRegistry', `LRU Evicting idle model [${oldestId}] to reclaim memory`);
      return await this.releaseHandle(oldestId, true);
    }

    Logger.warn('ModelHandleRegistry', 'No idle unlocked models available for LRU eviction');
    return false;
  }
}
