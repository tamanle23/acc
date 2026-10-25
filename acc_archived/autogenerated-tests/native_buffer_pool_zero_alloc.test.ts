import { describe, it, expect } from 'bun:test';
import { NativeBufferPool } from '@acc/core';

describe('NativeBufferPool Zero-Allocation Test Suite', () => {
  it('prewarms and recycles native buffers across 1,000 frames without new allocations', () => {
    const pool = NativeBufferPool.getInstance();
    pool.clear();

    const bufferSize = 1920 * 1080 * 4; // 8.29MB (1080p RGBA)
    pool.prewarm(bufferSize, 4);

    expect(pool.getAvailableCount(bufferSize)).toBe(4);
    expect(pool.getTotalAllocated()).toBe(4);

    // Simulate 1,000 frame loop
    for (let f = 0; f < 1000; f++) {
      const buf = pool.acquire(bufferSize);
      expect(buf.byteLength).toBe(bufferSize);

      // Perform simulated pixel write
      buf[0] = f % 256;
      buf[1] = (f * 2) % 256;

      // Release back to pool
      pool.release(buf);
    }

    // Pool must have allocated exactly 4 buffers total for the entire 1,000 frame run!
    expect(pool.getTotalAllocated()).toBe(4);
    expect(pool.getAvailableCount(bufferSize)).toBe(4);
  });
});
