import { describe, it, expect, beforeEach } from 'bun:test';
import { UniversalCanvasProvider } from '../packages/core/src/isomorphic/canvas/UniversalCanvasProvider';
import { CanvasScratchPool } from '../packages/core/src/isomorphic/canvas/CanvasScratchPool';
import { NapiCanvasAdapter } from '../packages/core/src/native';

describe('CanvasScratchPool & Tiered Resolution Bucketing Suite', () => {
  beforeEach(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter());
    CanvasScratchPool.getInstance().clear();
  });

  it('maps arbitrary dimensions to standard enclosing resolution tiers', () => {
    const pool = CanvasScratchPool.getInstance();

    const t1 = pool.getBucketKey(200, 200);
    expect(t1.key).toBe('256x256');
    expect(t1.bucketWidth).toBe(256);
    expect(t1.bucketHeight).toBe(256);

    const t2 = pool.getBucketKey(600, 300);
    expect(t2.key).toBe('640x360');

    const t3 = pool.getBucketKey(1200, 700);
    expect(t3.key).toBe('1280x720');

    const t4 = pool.getBucketKey(1920, 1080);
    expect(t4.key).toBe('1920x1080');

    // Super custom dimension beyond standard tiers rounds up to 128 multiple
    const t5 = pool.getBucketKey(4000, 2500);
    expect(t5.bucketWidth).toBe(4096);
    expect(t5.bucketHeight).toBe(2560);
  });

  it('acquires and releases canvas instances without re-allocating new objects', () => {
    const pool = CanvasScratchPool.getInstance();

    const c1 = UniversalCanvasProvider.acquireScratchCanvas(500, 500);
    expect(c1).toBeDefined();

    const stats1 = pool.getStats();
    expect(stats1.inUse).toBe(1);
    expect(stats1.availableInPool).toBe(0);

    UniversalCanvasProvider.releaseScratchCanvas(c1);

    const stats2 = pool.getStats();
    expect(stats2.inUse).toBe(0);
    expect(stats2.availableInPool).toBe(1);

    // Second acquire should reuse the identical canvas instance
    const c2 = UniversalCanvasProvider.acquireScratchCanvas(480, 480);
    expect(c2).toBe(c1);

    const stats3 = pool.getStats();
    expect(stats3.inUse).toBe(1);
    expect(stats3.availableInPool).toBe(0);

    UniversalCanvasProvider.releaseScratchCanvas(c2);
  });
});
