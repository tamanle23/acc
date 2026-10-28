import { describe, it, expect, beforeEach } from 'bun:test';
import { WebCodecsDecoderPool } from '../apps/studio/src/renderer/workers/WebCodecsDecoderPool';
import { MediabunnyWorkerReader } from '../apps/studio/src/renderer/workers/MediabunnyWorkerReader';
import { ContentCacheRegistry, MemoryCacheStrategy } from '@acc/core-isomorphic';

describe('WebCodecsDecoderPool & Hardware Quota Invariants Suite', () => {
  let pool: WebCodecsDecoderPool;

  const createMockReader = (id: string, src = `video_${id}.mp4`): MediabunnyWorkerReader => {
    let initialized = false;
    let evictedCount = 0;

    const reader = {
      src,
      assetId: id,
      width: 1920,
      height: 1080,
      fps: 30,
      durationSec: 10,
      getIsInitialized: () => initialized,
      reacquireHardwareDecoder: async () => {
        initialized = true;
        return true;
      },
      evictHardwareDecoder: () => {
        initialized = false;
        evictedCount++;
      },
      dispose: () => {
        initialized = false;
      },
      requestFrame: async () => null,
      getEvictedCount: () => evictedCount,
    } as unknown as MediabunnyWorkerReader;

    return reader;
  };

  beforeEach(() => {
    pool = WebCodecsDecoderPool.getInstance();
    pool.clear();
    pool.setMaxHardwareDecoders(8);
  });

  // =========================================================================
  // 1. Quota Ceiling & Lease Enforcements
  // =========================================================================
  describe('Quota Ceiling & Hardware Lease Limits', () => {
    it('strictly limits active hardware decoder leases to maxHardwareDecoders (<= 8)', async () => {
      const totalReaders = 20;
      const readers: MediabunnyWorkerReader[] = [];

      for (let i = 0; i < totalReaders; i++) {
        const reader = createMockReader(`asset_${i}`);
        readers.push(reader);
        pool.register(`asset_${i}`, reader);
      }

      expect(pool.getPoolSize()).toBe(20);
      expect(pool.getActiveLeaseCount()).toBe(0);

      // Acquire leases sequentially for all 20 readers
      for (let i = 0; i < totalReaders; i++) {
        await pool.acquireLease(`asset_${i}`, i * 10);
        // Active lease count must NEVER exceed 8 at any point in time
        expect(pool.getActiveLeaseCount()).toBeLessThanOrEqual(8);
      }

      expect(pool.getActiveLeaseCount()).toBe(8);
    });

    it('dynamically reduces lease count when setMaxHardwareDecoders is lowered', async () => {
      for (let i = 0; i < 10; i++) {
        const reader = createMockReader(`asset_${i}`);
        pool.register(`asset_${i}`, reader);
        await pool.acquireLease(`asset_${i}`, i);
      }

      expect(pool.getActiveLeaseCount()).toBe(8);

      // Dynamically lower limit to 4
      pool.setMaxHardwareDecoders(4);
      expect(pool.getActiveLeaseCount()).toBe(4);

      // Dynamically lower limit to 2
      pool.setMaxHardwareDecoders(2);
      expect(pool.getActiveLeaseCount()).toBe(2);
    });
  });

  // =========================================================================
  // 2. Priority Scoring & Playhead Proximity
  // =========================================================================
  describe('Playhead Proximity Priority Evaluation & Eviction', () => {
    it('prioritizes active playhead sequence over distant background assets', async () => {
      const nearPlayheadReader = createMockReader('near_playhead');
      const farDistantReader = createMockReader('far_distant');

      pool.register('near_playhead', nearPlayheadReader);
      pool.register('far_distant', farDistantReader);

      // Mock timeline with near sequence at [0, 60] and far sequence at [900, 1000]
      const mockTimeline = {
        sequences: new Map([
          ['seq_near', { assetId: 'near_playhead', startFrame: 0, durationFrames: 60 }],
          ['seq_far', { assetId: 'far_distant', startFrame: 900, durationFrames: 100 }],
        ]),
      };

      pool.updatePriorities({
        playheadFrame: 30, // Inside near sequence
        fps: 30,
        timeline: mockTimeline,
      });

      const nearItem = pool.getItem('near_playhead');
      const farItem = pool.getItem('far_distant');

      expect(nearItem?.priorityScore).toBe(10000); // Playhead hit
      expect(farItem?.priorityScore).toBe(0); // Distant (870 frames away)
    });

    it('evicts the lowest-priority reader when acquiring a lease at quota limit', async () => {
      pool.setMaxHardwareDecoders(3);

      const r1 = createMockReader('low_1');
      const r2 = createMockReader('low_2');
      const r3 = createMockReader('low_3');
      const highHero = createMockReader('high_hero');

      pool.register('low_1', r1);
      pool.register('low_2', r2);
      pool.register('low_3', r3);
      pool.register('high_hero', highHero);

      // Fill 3 slots with low priority (score: 50)
      await pool.acquireLease('low_1', 50);
      await pool.acquireLease('low_2', 50);
      await pool.acquireLease('low_3', 50);

      expect(pool.getActiveLeaseCount()).toBe(3);

      // High hero requests slot with priority 10000
      const acquired = await pool.acquireLease('high_hero', 10000);
      expect(acquired).toBe(true);
      expect(pool.getActiveLeaseCount()).toBe(3);
      expect(highHero.getIsInitialized()).toBe(true);

      // At least one of low readers must have been evicted
      const totalEvictions =
        (r1 as any).getEvictedCount() +
        (r2 as any).getEvictedCount() +
        (r3 as any).getEvictedCount();
      expect(totalEvictions).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 3. Auto-Recovery Ladder on GPU Driver QuotaExceededError
  // =========================================================================
  describe('QuotaExceededError Auto-Recovery Ladder', () => {
    it('automatically drops max decoders and evicts background slots on quota error', () => {
      pool.setMaxHardwareDecoders(8);

      pool.handleQuotaExceeded('faulty_asset');
      expect(pool.getMaxHardwareDecoders()).toBe(6);

      pool.handleQuotaExceeded('faulty_asset');
      expect(pool.getMaxHardwareDecoders()).toBe(4);

      pool.handleQuotaExceeded('faulty_asset');
      expect(pool.getMaxHardwareDecoders()).toBe(2);

      // Floor clamp at 2
      pool.handleQuotaExceeded('faulty_asset');
      expect(pool.getMaxHardwareDecoders()).toBe(2);
    });
  });

  // =========================================================================
  // 4. OPFS Poster Cache Graceful Fallback
  // =========================================================================
  describe('OPFS Keyframe Poster Fallback Resiliency', () => {
    it('gracefully checks poster cache when reader is uninitialized or evicted', async () => {
      // Register memory cache strategy in ContentCacheRegistry
      ContentCacheRegistry.register(new MemoryCacheStrategy('memory-poster', 'Memory Poster Fallback'), true);

      const reader = new MediabunnyWorkerReader('test_clip.mp4', { assetId: 'asset_cached_poster' });
      expect(reader.getIsInitialized()).toBe(false);

      // When uninitialized, requestFrame attempts poster lookup and returns null without throwing
      const frameResult = await reader.requestFrame(10, 30, false);
      expect(frameResult).toBeNull();

      reader.dispose();
    });
  });
});
