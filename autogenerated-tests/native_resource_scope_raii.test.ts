import { describe, it, expect, beforeEach, mock } from 'bun:test';
import {
  NativeResourceManager,
  FrameResourceScope,
  SequenceResourceScope,
  NativeResourceWrapper,
} from '@acc/core-isomorphic';

describe('Iteration 45: Scoped Native GPU Resource Engine (RAII)', () => {
  let manager: NativeResourceManager;

  beforeEach(() => {
    manager = NativeResourceManager.getInstance();
    manager.clear();
    manager.setMaxGpuBytes(64 * 1024 * 1024); // 64 MB
  });

  describe('FrameResourceScope', () => {
    it('synchronously closes all registered transient media buffers on dispose', () => {
      let closedCount = 0;
      const scope = manager.createFrameScope('test-frame-1');

      const mockBitmap1 = { close: mock(() => closedCount++) };
      const mockBitmap2 = { close: mock(() => closedCount++) };

      const res1 = manager.register('bmp-1', mockBitmap1, { byteSize: 8 * 1024 * 1024, scope });
      const res2 = manager.register('bmp-2', mockBitmap2, { byteSize: 8 * 1024 * 1024, scope });

      expect(manager.getCurrentBytes()).toBe(16 * 1024 * 1024);
      expect(res1.isDisposed).toBe(false);
      expect(res2.isDisposed).toBe(false);

      // Frame ends
      scope.dispose();

      expect(closedCount).toBe(2);
      expect(res1.isDisposed).toBe(true);
      expect(res2.isDisposed).toBe(true);
      expect(manager.getCurrentBytes()).toBe(0);
    });

    it('immediately closes newly registered resources if scope is already disposed', () => {
      const scope = manager.createFrameScope('test-frame-disposed');
      scope.dispose();

      let closed = false;
      const res = new NativeResourceWrapper('late-bmp', { close: () => { closed = true; } });
      scope.register(res);

      expect(closed).toBe(true);
      expect(res.isDisposed).toBe(true);
    });
  });

  describe('SequenceResourceScope', () => {
    it('maintains sequence-scoped textures and disposes them when sequence ends', () => {
      let cutoutClosed = false;
      let depthClosed = false;

      const scope = manager.getOrCreateSequenceScope('seq-101');

      manager.register('cutout-101', { close: () => { cutoutClosed = true; } }, {
        byteSize: 8 * 1024 * 1024,
        scope,
        pinned: true,
      });

      manager.register('depth-101', { close: () => { depthClosed = true; } }, {
        byteSize: 8 * 1024 * 1024,
        scope,
        pinned: true,
      });

      expect(manager.getCurrentBytes()).toBe(16 * 1024 * 1024);
      expect(cutoutClosed).toBe(false);
      expect(depthClosed).toBe(false);

      // Sequence unmounts or cuts
      manager.disposeSequenceScope('seq-101');

      expect(cutoutClosed).toBe(true);
      expect(depthClosed).toBe(true);
      expect(manager.getCurrentBytes()).toBe(0);
    });
  });

  describe('Hard Memory Budgeting & Synchronous Eviction', () => {
    it('enforces memory budget and synchronously evicts unpinned resources via LRU', () => {
      manager.setMaxGpuBytes(20 * 1024 * 1024); // 20 MB budget for test

      let res1Closed = false;
      let res2Closed = false;

      // Allocate 8 MB (unpinned)
      manager.register('lru-1', { close: () => { res1Closed = true; } }, {
        byteSize: 8 * 1024 * 1024,
        pinned: false,
      });

      // Allocate 8 MB (unpinned)
      manager.register('lru-2', { close: () => { res2Closed = true; } }, {
        byteSize: 8 * 1024 * 1024,
        pinned: false,
      });

      expect(manager.getCurrentBytes()).toBe(16 * 1024 * 1024);

      // Requesting 8 MB more would exceed 20 MB (16 + 8 = 24 > 20)
      // Must evict oldest unpinned resource ('lru-1')
      manager.register('lru-3', { close: () => {} }, {
        byteSize: 8 * 1024 * 1024,
        pinned: false,
      });

      expect(res1Closed).toBe(true);
      expect(res2Closed).toBe(false);
      expect(manager.getCurrentBytes()).toBe(16 * 1024 * 1024);
    });

    it('protects pinned resources from eviction', () => {
      manager.setMaxGpuBytes(16 * 1024 * 1024); // 16 MB

      let pinnedClosed = false;
      let unpinnedClosed = false;

      // Pinned 8 MB
      manager.register('pinned-hero', { close: () => { pinnedClosed = true; } }, {
        byteSize: 8 * 1024 * 1024,
        pinned: true,
      });

      // Unpinned 8 MB
      manager.register('unpinned-scrub', { close: () => { unpinnedClosed = true; } }, {
        byteSize: 8 * 1024 * 1024,
        pinned: false,
      });

      // Allocating another 8MB must evict unpinned-scrub, NEVER pinned-hero
      manager.register('new-frame', { close: () => {} }, {
        byteSize: 8 * 1024 * 1024,
        pinned: false,
      });

      expect(unpinnedClosed).toBe(true);
      expect(pinnedClosed).toBe(false);
      expect(manager.getCurrentBytes()).toBe(16 * 1024 * 1024);
    });
  });
});
