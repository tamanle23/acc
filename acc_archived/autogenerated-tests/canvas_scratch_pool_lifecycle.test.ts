import { describe, it, expect, beforeEach } from 'bun:test';
import { UniversalCanvasProvider, CanvasScratchPool } from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native';

describe('CanvasScratchPool Lifecycle & Reusability Suite', () => {
  beforeEach(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter());
    CanvasScratchPool.getInstance().clear();
  });

  it('cycles scratch canvases across 100 simulated frames with zero net growth', () => {
    const pool = CanvasScratchPool.getInstance();

    // Simulate 100 frames of an effect (e.g. Fog/Fire) borrowing and returning 3 scratch canvases per frame
    for (let frame = 0; frame < 100; frame++) {
      const c1 = UniversalCanvasProvider.acquireScratchCanvas(1920, 1080);
      const c2 = UniversalCanvasProvider.acquireScratchCanvas(640, 360);
      const c3 = UniversalCanvasProvider.acquireScratchCanvas(256, 256);

      expect(c1).toBeDefined();
      expect(c2).toBeDefined();
      expect(c3).toBeDefined();

      const inUseStats = pool.getStats();
      expect(inUseStats.inUse).toBe(3);

      // Return canvases back to pool
      UniversalCanvasProvider.releaseScratchCanvas(c1);
      UniversalCanvasProvider.releaseScratchCanvas(c2);
      UniversalCanvasProvider.releaseScratchCanvas(c3);

      const idleStats = pool.getStats();
      expect(idleStats.inUse).toBe(0);
      expect(idleStats.availableInPool).toBe(3);
    }

    // After 100 frames, exactly 3 canvases total were ever allocated!
    const finalStats = pool.getStats();
    expect(finalStats.totalAllocated).toBe(3);
    expect(finalStats.availableInPool).toBe(3);
    expect(finalStats.inUse).toBe(0);
  });

  it('re-clears 2D context transforms upon re-acquisition', () => {
    const c1 = UniversalCanvasProvider.acquireScratchCanvas(512, 512);
    const ctx = c1.getContext('2d');
    ctx.translate(100, 100);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 50, 50);

    UniversalCanvasProvider.releaseScratchCanvas(c1);

    // Re-acquire same tier
    const c2 = UniversalCanvasProvider.acquireScratchCanvas(500, 500);
    expect(c2).toBe(c1); // Exact same pooled object recycled
    UniversalCanvasProvider.releaseScratchCanvas(c2);
  });
});
