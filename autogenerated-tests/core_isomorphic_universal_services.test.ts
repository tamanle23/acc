import { describe, it, expect, beforeEach } from 'bun:test';
import {
  UniversalLogger,
  LogLevel,
  IUniversalLoggerSink,
  fastChecksum,
  MemoryCacheStrategy,
  ContentCacheRegistry,
  IContentCacheStrategy,
} from '../packages/core-isomorphic/src';

describe('Phase 1: Universal Isomorphic Services Suite (@acc/core-isomorphic)', () => {
  describe('UniversalLogger', () => {
    it('formats log messages and respects log levels', () => {
      const logs: Array<{ level: LogLevel; namespace: string; message: string }> = [];
      const mockSink: IUniversalLoggerSink = {
        log: (level, namespace, message) => {
          logs.push({ level, namespace, message });
        },
      };

      UniversalLogger.setSink(mockSink);
      UniversalLogger.setLevel(LogLevel.WARN);

      UniversalLogger.debug('test', 'should not appear');
      UniversalLogger.info('test', 'should not appear');
      UniversalLogger.warn('test', 'warning message');
      UniversalLogger.error('test', 'error message');

      expect(logs.length).toBe(2);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[0].message).toBe('warning message');
      expect(logs[1].level).toBe(LogLevel.ERROR);
      expect(logs[1].message).toBe('error message');

      // Reset to default
      UniversalLogger.setLevel(LogLevel.INFO);
    });
  });

  describe('fastChecksum', () => {
    it('produces deterministic 8-character hex strings for strings and Uint8Array', () => {
      const hashStr1 = fastChecksum('hello world');
      const hashStr2 = fastChecksum('hello world');
      const hashStrDiff = fastChecksum('hello world!');

      expect(hashStr1).toBe(hashStr2);
      expect(hashStr1.length).toBe(8);
      expect(hashStr1).not.toBe(hashStrDiff);

      const buffer = new Uint8Array([104, 101, 108, 108, 111]); // 'hello'
      const hashBuf = fastChecksum(buffer);
      expect(hashBuf.length).toBe(8);
      expect(typeof hashBuf).toBe('string');
    });
  });

  describe('ContentCacheStrategy & ContentCacheRegistry', () => {
    beforeEach(() => {
      ContentCacheRegistry.reset();
    });

    it('stores, retrieves, checks, and evicts entries in MemoryCacheStrategy', async () => {
      const cache = new MemoryCacheStrategy(2);
      const data1 = new Uint8Array([1, 2, 3]);
      const data2 = new Uint8Array([4, 5, 6]);
      const data3 = new Uint8Array([7, 8, 9]);

      await cache.set('k1', data1);
      await cache.set('k2', data2);

      expect(await cache.has('k1')).toBe(true);
      expect(await cache.has('k2')).toBe(true);

      const retrieved1 = await cache.get('k1');
      expect(retrieved1).toEqual(data1);

      // Inserting third item should evict oldest (k2 was less recently used than k1)
      await cache.set('k3', data3);
      expect(await cache.has('k3')).toBe(true);
      expect(await cache.has('k1')).toBe(true);
      expect(await cache.has('k2')).toBe(false);

      await cache.delete('k1');
      expect(await cache.has('k1')).toBe(false);

      await cache.clear();
      expect(await cache.has('k3')).toBe(false);
    });

    it('manages default and custom cache strategies via ContentCacheRegistry', async () => {
      const defaultStrat = ContentCacheRegistry.get();
      expect(defaultStrat.id).toBe('memory');

      class MockCustomStrategy implements IContentCacheStrategy {
        public readonly id = 'custom';
        public readonly name = 'Custom Strategy';
        async has() { return false; }
        async get() { return null; }
        async set() {}
        async delete() { return true; }
        async clear() {}
      }

      const custom = new MockCustomStrategy();
      ContentCacheRegistry.register(custom);
      expect(ContentCacheRegistry.has('custom')).toBe(true);
      expect(ContentCacheRegistry.get('custom').id).toBe('custom');

      ContentCacheRegistry.setDefault('custom');
      expect(ContentCacheRegistry.get().id).toBe('custom');
    });
  });
});
