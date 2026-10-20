import type { ICanvasInstance, CanvasEnvironment } from './types';
import { UniversalCanvasProvider } from './UniversalCanvasProvider';

export interface ScratchPoolStats {
  totalAllocated: number;
  availableInPool: number;
  inUse: number;
  bucketDistribution: Record<string, number>;
}

/**
 * CanvasScratchPool:
 * High-performance tiered resolution bucketed pool for scratch canvases.
 * Solves frame-loop GC spikes from frequent `createCanvas` allocations across
 * shader passes, relighting, depth heuristics, particle overlay generators, and preview filters.
 */
export class CanvasScratchPool {
  private static instance: CanvasScratchPool | null = null;

  // Standard resolution tiers:
  // Tiny (256x256), Quarter (640x360), 720p (1280x720), 1080p (1920x1080), 4K (3840x2160)
  private static readonly TIERS: [number, number][] = [
    [256, 256],
    [512, 512],
    [640, 360],
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ];

  private pool: Map<string, ICanvasInstance[]> = new Map();
  private inUseSet: Set<ICanvasInstance> = new Set();
  private canvasToBucketKey: WeakMap<ICanvasInstance, string> = new WeakMap();
  private maxPerBucket: number = 8;

  public static getInstance(): CanvasScratchPool {
    if (!CanvasScratchPool.instance) {
      CanvasScratchPool.instance = new CanvasScratchPool();
    }
    return CanvasScratchPool.instance;
  }

  /**
   * Finds the nearest enclosing standard resolution tier or computes custom bucket key.
   */
  public getBucketKey(width: number, height: number): { key: string; bucketWidth: number; bucketHeight: number } {
    for (const [tw, th] of CanvasScratchPool.TIERS) {
      if (width <= tw && height <= th) {
        return { key: `${tw}x${th}`, bucketWidth: tw, bucketHeight: th };
      }
    }
    // Round up to nearest multiple of 128 to prevent unbounded bespoke buckets
    const bw = Math.ceil(width / 128) * 128;
    const bh = Math.ceil(height / 128) * 128;
    return { key: `${bw}x${bh}`, bucketWidth: bw, bucketHeight: bh };
  }

  /**
   * Acquires a scratch canvas instance from the pool matching or exceeding the requested dimensions.
   */
  public acquire(width: number, height: number, engine?: CanvasEnvironment): ICanvasInstance {
    const { key, bucketWidth, bucketHeight } = this.getBucketKey(width, height);
    const bucket = this.pool.get(key);

    let canvas: ICanvasInstance;
    if (bucket && bucket.length > 0) {
      canvas = bucket.pop()!;
    } else {
      // Allocate new canvas in bucket dimensions
      canvas = UniversalCanvasProvider.createCanvas(bucketWidth, bucketHeight, engine);
    }

    // Reset transform & clear rect
    try {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, bucketWidth, bucketHeight);
      }
    } catch {
      // Ignore if webgl or headless context
    }

    this.inUseSet.add(canvas);
    this.canvasToBucketKey.set(canvas, key);
    return canvas;
  }

  /**
   * Releases an acquired scratch canvas back into the pool.
   */
  public release(canvas: ICanvasInstance): void {
    if (!this.inUseSet.has(canvas)) {
      return;
    }
    this.inUseSet.delete(canvas);

    const key = this.canvasToBucketKey.get(canvas);
    if (!key) return;

    let bucket = this.pool.get(key);
    if (!bucket) {
      bucket = [];
      this.pool.set(key, bucket);
    }

    if (bucket.length < this.maxPerBucket) {
      bucket.push(canvas);
    }
    // Else let excess canvases be naturally collected by GC
  }

  /**
   * Empties all pooled canvases and resets tracking.
   */
  public clear(): void {
    this.pool.clear();
    this.inUseSet.clear();
  }

  public getStats(): ScratchPoolStats {
    let availableInPool = 0;
    const bucketDistribution: Record<string, number> = {};
    for (const [k, v] of this.pool.entries()) {
      bucketDistribution[k] = v.length;
      availableInPool += v.length;
    }
    return {
      totalAllocated: availableInPool + this.inUseSet.size,
      availableInPool,
      inUse: this.inUseSet.size,
      bucketDistribution,
    };
  }
}
