import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { NativeFileCacheStrategy } from '../packages/core/src/cache/NativeFileCacheStrategy';
import { NativeBufferPool } from '../packages/core/src/buffer/NativeBufferPool';

describe('Phase 3: Core Native Merger & NativeFileCache Suite (@acc/core)', () => {
  const testCacheDir = path.join(os.tmpdir(), `acc_test_cache_${Date.now()}`);

  beforeEach(() => {
    if (!fs.existsSync(testCacheDir)) {
      fs.mkdirSync(testCacheDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('NativeBufferPool in @acc/core', () => {
    it('prewarms and recycles native buffers adhering to zero-alloc loop', () => {
      const pool = NativeBufferPool.getInstance();
      pool.clear();

      const size = 1024 * 1024; // 1MB
      pool.prewarm(size, 4);

      expect(pool.getAvailableCount(size)).toBe(4);

      const buf1 = pool.acquire(size);
      expect(pool.getAvailableCount(size)).toBe(3);

      pool.release(buf1);
      expect(pool.getAvailableCount(size)).toBe(4);
    });
  });

  describe('NativeFileCacheStrategy in @acc/core', () => {
    it('persists, checks, retrieves, and deletes binary data with metadata', async () => {
      const cache = new NativeFileCacheStrategy({ baseDir: testCacheDir });
      expect(cache.id).toBe('native-file');

      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const key = 'depth_layer_test_key';

      expect(await cache.has(key)).toBe(false);

      await cache.set(key, data, { mimeType: 'image/png' });
      expect(await cache.has(key)).toBe(true);

      const retrieved = await cache.get(key);
      expect(retrieved).not.toBeNull();
      expect(retrieved).toEqual(data);

      const keys = await cache.getKeys();
      expect(keys).toContain(key);

      const deleted = await cache.delete(key);
      expect(deleted).toBe(true);
      expect(await cache.has(key)).toBe(false);
      expect(await cache.get(key)).toBeNull();
    });
  });
});
