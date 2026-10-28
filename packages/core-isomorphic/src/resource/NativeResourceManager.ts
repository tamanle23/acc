import {
  type INativeResource,
  type INativeResourceScope,
  NativeResourceWrapper,
  FrameResourceScope,
  SequenceResourceScope,
} from './NativeResourceScope';

export interface ResourceStats {
  totalBytes: number;
  maxBytes: number;
  resourceCount: number;
  unpinnedBytes: number;
  scopeCount: number;
}

/**
 * NativeResourceManager:
 * Centralized singleton managing unmanaged GPU native media textures
 * across browser Web Workers and Node/Bun headless export processes.
 *
 * Enforces:
 * 1. Hard GPU memory ceiling (default: 64 MB).
 * 2. Scoped RAII resource tracking (FrameScope, SequenceScope).
 * 3. Synchronous LRU eviction of unpinned native resources.
 */
export class NativeResourceManager {
  private static instance: NativeResourceManager | null = null;

  // Hard 64MB ceiling by default (customizable via setMaxGpuBytes)
  private maxGpuBytes: number = 64 * 1024 * 1024;
  private currentBytes: number = 0;

  // Track all live native resources with LRU timestamps
  private resources = new Map<string, { resource: INativeResource; lastAccess: number }>();
  private scopes = new Map<string, INativeResourceScope>();

  private constructor() {}

  public static getInstance(): NativeResourceManager {
    if (!NativeResourceManager.instance) {
      NativeResourceManager.instance = new NativeResourceManager();
    }
    return NativeResourceManager.instance;
  }

  public setMaxGpuBytes(maxBytes: number): void {
    this.maxGpuBytes = Math.max(16 * 1024 * 1024, maxBytes);
  }

  public getMaxGpuBytes(): number {
    return this.maxGpuBytes;
  }

  public getCurrentBytes(): number {
    return this.currentBytes;
  }

  /**
   * Creates a transient frame scope that automatically closes all registered buffers
   * when disposed at the end of the frame tick.
   */
  public createFrameScope(id: string = `frame-${performance.now()}`): FrameResourceScope {
    const scope = new FrameResourceScope(id, (disposedScope) => {
      this.scopes.delete(disposedScope.id);
    });
    this.scopes.set(scope.id, scope);
    return scope;
  }

  /**
   * Retrieves or creates a sequence-scoped resource container bounded to clip lifecycle.
   */
  public getOrCreateSequenceScope(sequenceId: string): SequenceResourceScope {
    const existing = this.scopes.get(sequenceId);
    if (existing && !existing.isDisposed && existing instanceof SequenceResourceScope) {
      return existing;
    }
    const scope = new SequenceResourceScope(sequenceId, (disposedScope) => {
      this.scopes.delete(disposedScope.id);
    });
    this.scopes.set(sequenceId, scope);
    return scope;
  }

  /**
   * Disposes and unregisters a sequence scope and all its contained native buffers.
   */
  public disposeSequenceScope(sequenceId: string): void {
    const scope = this.scopes.get(sequenceId);
    if (scope) {
      scope.dispose();
      this.scopes.delete(sequenceId);
    }
  }

  /**
   * Wraps an unmanaged native buffer and registers it with the resource manager.
   * If registering the resource would breach the budget, synchronously evicts unpinned resources.
   */
  public register<T = any>(
    id: string,
    raw: T,
    options: {
      byteSize?: number;
      pinned?: boolean;
      scope?: INativeResourceScope;
    } = {}
  ): INativeResource {
    const wrapper = new NativeResourceWrapper(id, raw, {
      byteSize: options.byteSize,
      pinned: options.pinned,
      onDispose: (res) => {
        this.unregister(res.id);
      },
    });

    // Enforce budget guard
    this.evictToFit(wrapper.byteSize);

    this.currentBytes += wrapper.byteSize;
    this.resources.set(id, { resource: wrapper, lastAccess: performance.now() });

    if (options.scope) {
      options.scope.register(wrapper);
    }

    return wrapper;
  }

  public touch(id: string): void {
    const entry = this.resources.get(id);
    if (entry) {
      entry.lastAccess = performance.now();
    }
  }

  private unregister(id: string): void {
    const entry = this.resources.get(id);
    if (entry) {
      this.currentBytes = Math.max(0, this.currentBytes - entry.resource.byteSize);
      this.resources.delete(id);
    }
  }

  /**
   * Evicts unpinned native resources in LRU order until the requested memory budget fits.
   */
  public evictToFit(requiredBytes: number): boolean {
    if (this.currentBytes + requiredBytes <= this.maxGpuBytes) {
      return true;
    }

    // Collect unpinned candidates sorted by oldest access
    const unpinned: Array<{ id: string; resource: INativeResource; lastAccess: number }> = [];
    for (const [id, entry] of this.resources.entries()) {
      if (!entry.resource.isPinned && !entry.resource.isDisposed) {
        unpinned.push({ id, resource: entry.resource, lastAccess: entry.lastAccess });
      }
    }

    unpinned.sort((a, b) => a.lastAccess - b.lastAccess);

    for (const item of unpinned) {
      if (this.currentBytes + requiredBytes <= this.maxGpuBytes) {
        break;
      }
      // Synchronously close evicted native resource
      item.resource.close();
    }

    return this.currentBytes + requiredBytes <= this.maxGpuBytes;
  }

  public getStats(): ResourceStats {
    let unpinnedBytes = 0;
    for (const entry of this.resources.values()) {
      if (!entry.resource.isPinned) {
        unpinnedBytes += entry.resource.byteSize;
      }
    }
    return {
      totalBytes: this.currentBytes,
      maxBytes: this.maxGpuBytes,
      resourceCount: this.resources.size,
      unpinnedBytes,
      scopeCount: this.scopes.size,
    };
  }

  /**
   * Purges all tracked scopes and closes all active native resources.
   */
  public clear(): void {
    for (const scope of this.scopes.values()) {
      try {
        scope.dispose();
      } catch {}
    }
    this.scopes.clear();

    for (const entry of this.resources.values()) {
      try {
        entry.resource.close();
      } catch {}
    }
    this.resources.clear();
    this.currentBytes = 0;
  }
}
