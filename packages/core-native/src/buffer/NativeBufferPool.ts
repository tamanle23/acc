/**
 * NativeBufferPool:
 * Zero-allocation aligned buffer pooling adhering strictly to ZERO-ALLOC-FRAME-LOOP.
 * Pre-allocates and recycles native buffers across frame loops without GC nursery churn.
 */
export class NativeBufferPool {
  private static instance: NativeBufferPool;
  private pool: Map<number, Uint8Array[]> = new Map();
  private maxPoolSizePerBucket: number = 8;
  private totalAllocatedCount: number = 0;

  public static getInstance(): NativeBufferPool {
    if (!NativeBufferPool.instance) {
      NativeBufferPool.instance = new NativeBufferPool();
    }
    return NativeBufferPool.instance;
  }

  /**
   * Pre-warms the buffer pool for specific byte dimensions (e.g., 1080p RGBA = 1920 * 1080 * 4 = 8,294,400 bytes).
   */
  public prewarm(sizeBytes: number, count: number = 4): void {
    let bucket = this.pool.get(sizeBytes);
    if (!bucket) {
      bucket = [];
      this.pool.set(sizeBytes, bucket);
    }
    while (bucket.length < count) {
      bucket.push(new Uint8Array(sizeBytes));
      this.totalAllocatedCount++;
    }
  }

  /**
   * Acquires a recycled buffer of the requested size, or allocates a new aligned buffer if empty.
   */
  public acquire(sizeBytes: number): Uint8Array {
    const bucket = this.pool.get(sizeBytes);
    if (bucket && bucket.length > 0) {
      return bucket.pop()!;
    }
    this.totalAllocatedCount++;
    return new Uint8Array(sizeBytes);
  }

  /**
   * Returns a buffer back to the pool for reuse in subsequent frames.
   */
  public release(buffer: Uint8Array): void {
    const size = buffer.byteLength;
    let bucket = this.pool.get(size);
    if (!bucket) {
      bucket = [];
      this.pool.set(size, bucket);
    }
    if (bucket.length < this.maxPoolSizePerBucket) {
      bucket.push(buffer);
    }
  }

  public getAvailableCount(sizeBytes: number): number {
    return this.pool.get(sizeBytes)?.length ?? 0;
  }

  public getTotalAllocated(): number {
    return this.totalAllocatedCount;
  }

  public clear(): void {
    this.pool.clear();
    this.totalAllocatedCount = 0;
  }
}
