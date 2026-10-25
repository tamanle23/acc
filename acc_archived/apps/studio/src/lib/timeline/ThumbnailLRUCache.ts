/**
 * ThumbnailLRUCache:
 * Memory-hygienic LRU cache for filmstrip thumbnails and video frames.
 * Explicitly calls .close() on evicted ImageBitmap or VideoFrame objects to eliminate GPU memory leaks and OOM crashes.
 */
export interface DisposableBitmap {
  close(): void;
  width: number;
  height: number;
}

export class ThumbnailLRUCache<T extends DisposableBitmap = DisposableBitmap> {
  private cache: Map<string, T> = new Map();
  private maxItems: number;

  constructor(maxItems: number = 64) {
    this.maxItems = Math.max(1, maxItems);
  }

  public get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (item) {
      // Re-insert to refresh LRU order (most recently used at end)
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  public set(key: string, value: T): void {
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      if (existing !== value) {
        this.disposeItem(existing);
      }
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxItems) {
      // Evict oldest (first key in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        const evicted = this.cache.get(oldestKey);
        this.cache.delete(oldestKey);
        if (evicted) {
          this.disposeItem(evicted);
        }
      }
    }
    this.cache.set(key, value);
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public delete(key: string): boolean {
    const item = this.cache.get(key);
    if (item) {
      this.disposeItem(item);
      return this.cache.delete(key);
    }
    return false;
  }

  public clear(): void {
    for (const item of this.cache.values()) {
      this.disposeItem(item);
    }
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  private disposeItem(item: T): void {
    try {
      if (typeof item.close === 'function') {
        item.close();
      }
    } catch (err) {
      // Ignore if already closed or transferred
    }
  }
}
