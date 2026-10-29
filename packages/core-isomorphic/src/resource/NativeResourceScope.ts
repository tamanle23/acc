/**
 * Scoped Native GPU Resource Engine (RAII)
 * Implements strict, scoped lifecycle management for unmanaged native GPU media buffers
 * (ImageBitmap, VideoFrame, OffscreenCanvas, HTMLCanvasElement).
 */

export interface INativeResource extends Disposable {
  readonly id: string;
  readonly byteSize: number;
  readonly isPinned: boolean;
  readonly isDisposed: boolean;
  pin(): void;
  unpin(): void;
  close(): void;
  getRaw(): any;
}

export interface INativeResourceScope extends Disposable {
  readonly id: string;
  readonly isDisposed: boolean;
  register<T extends INativeResource>(resource: T): T;
  get(id: string): INativeResource | undefined;
  has(id: string): boolean;
  onExit?(callback: () => void): void;
  dispose(): void;
  [Symbol.dispose](): void;
}

/**
 * Wraps any native media buffer or canvas into a trackable, disposable INativeResource.
 */
export class NativeResourceWrapper implements INativeResource {
  public readonly id: string;
  public readonly byteSize: number;
  private raw: any;
  private pinned: boolean;
  private disposed: boolean = false;
  private onDisposeCallback?: (resource: INativeResource) => void;

  constructor(
    id: string,
    raw: any,
    options: {
      byteSize?: number;
      pinned?: boolean;
      onDispose?: (resource: INativeResource) => void;
    } = {}
  ) {
    this.id = id;
    this.raw = raw;
    this.pinned = options.pinned ?? false;
    this.onDisposeCallback = options.onDispose;

    if (options.byteSize !== undefined) {
      this.byteSize = options.byteSize;
    } else {
      // Deduce byte size: width * height * 4 (standard 32-bit RGBA)
      const underlying = typeof raw?.getRawCanvas === 'function' ? raw.getRawCanvas() : raw;
      const w = underlying?.naturalWidth || underlying?.videoWidth || underlying?.width || 0;
      const h = underlying?.naturalHeight || underlying?.videoHeight || underlying?.height || 0;
      this.byteSize = w > 0 && h > 0 ? w * h * 4 : 1024 * 1024; // 1MB conservative fallback
    }
  }

  public get isPinned(): boolean {
    return this.pinned;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  public pin(): void {
    this.pinned = true;
  }

  public unpin(): void {
    this.pinned = false;
  }

  public getRaw(): any {
    return this.raw;
  }

  public close(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.raw) {
      if (typeof this.raw.close === 'function') {
        try {
          this.raw.close();
        } catch {}
      } else if (typeof (this.raw as any).getRawCanvas === 'function') {
        const underlying = (this.raw as any).getRawCanvas();
        if (underlying && typeof underlying.close === 'function') {
          try {
            underlying.close();
          } catch {}
        }
      }
    }

    if (this.onDisposeCallback) {
      try {
        this.onDisposeCallback(this);
      } catch {}
    }
    this.raw = null;
  }

  public [Symbol.dispose](): void {
    this.close();
  }
}

/**
 * Transient Frame Scope:
 * Disposed synchronously at the conclusion of each frame tick (lifetime <= 16ms).
 */
export class FrameResourceScope implements INativeResourceScope {
  public readonly id: string;
  private resources = new Map<string, INativeResource>();
  private cleanupCallbacks: Array<() => void> = [];
  private disposed = false;
  private onScopeDispose?: (scope: FrameResourceScope) => void;

  constructor(id: string = `frame-${performance.now()}`, onScopeDispose?: (scope: FrameResourceScope) => void) {
    this.id = id;
    this.onScopeDispose = onScopeDispose;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  public register<T extends INativeResource>(resource: T): T {
    if (this.disposed) {
      resource.close();
      return resource;
    }
    this.resources.set(resource.id, resource);
    return resource;
  }

  /**
   * Registers a deterministic RAII cleanup callback executed in LIFO order on frame exit.
   * Useful for returning borrowed pooled scratch canvases without destroying their backing buffer.
   */
  public onExit(callback: () => void): void {
    if (this.disposed) {
      try {
        callback();
      } catch {}
      return;
    }
    this.cleanupCallbacks.push(callback);
  }

  public get(id: string): INativeResource | undefined {
    return this.resources.get(id);
  }

  public has(id: string): boolean {
    return this.resources.has(id);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const res of this.resources.values()) {
      res.close();
    }
    this.resources.clear();

    for (let i = this.cleanupCallbacks.length - 1; i >= 0; i--) {
      try {
        this.cleanupCallbacks[i]();
      } catch {}
    }
    this.cleanupCallbacks.length = 0;

    if (this.onScopeDispose) {
      try {
        this.onScopeDispose(this);
      } catch {}
    }
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }
}

/**
 * Sequence Scope:
 * Bounded to sequence lifecycle on the timeline. Holds static pre-baked visual textures
 * (subject cutouts, depth maps, normals). Automatically disposed when sequence unmounts or cuts.
 */
export class SequenceResourceScope implements INativeResourceScope {
  public readonly id: string;
  private resources = new Map<string, INativeResource>();
  private metadata = new Map<string, any>();
  private disposed = false;
  private onScopeDispose?: (scope: SequenceResourceScope) => void;

  constructor(id: string, onScopeDispose?: (scope: SequenceResourceScope) => void) {
    this.id = id;
    this.onScopeDispose = onScopeDispose;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  public setMetadata<T = any>(key: string, value: T): void {
    if (this.disposed) return;
    this.metadata.set(key, value);
  }

  public getMetadata<T = any>(key: string): T | undefined {
    return this.metadata.get(key) as T | undefined;
  }

  public register<T extends INativeResource>(resource: T): T {
    if (this.disposed) {
      resource.close();
      return resource;
    }
    // If replacing existing resource with same ID, close old one first
    const existing = this.resources.get(resource.id);
    if (existing && existing !== resource) {
      existing.close();
    }
    this.resources.set(resource.id, resource);
    return resource;
  }

  public get(id: string): INativeResource | undefined {
    return this.resources.get(id);
  }

  public has(id: string): boolean {
    return this.resources.has(id);
  }

  public unregister(id: string): INativeResource | undefined {
    const res = this.resources.get(id);
    if (res) {
      this.resources.delete(id);
    }
    return res;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const res of this.resources.values()) {
      res.close();
    }
    this.resources.clear();
    this.metadata.clear();

    if (this.onScopeDispose) {
      try {
        this.onScopeDispose(this);
      } catch {}
    }
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }
}
