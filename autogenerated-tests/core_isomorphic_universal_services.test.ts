import { describe, it, expect, beforeEach } from 'bun:test';
import {
  UniversalLogger,
  LogLevel,
  IUniversalLoggerSink,
  fastChecksum,
  ContentCacheRegistry,
  type IContentCacheStrategy,
  type CachePayload,
  type CacheEntryMetadata,
  payloadToBlob,
  payloadToStream,
  streamToUint8Array,
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

    class MockStandardCacheStrategy implements IContentCacheStrategy {
      public readonly id = 'mock-storage';
      public readonly name = 'Mock Standard Storage';
      private store = new Map<string, { blob: Blob; metadata: CacheEntryMetadata }>();

      async has(key: string): Promise<boolean> {
        return this.store.has(key);
      }

      async get(key: string): Promise<Blob | null> {
        const entry = this.store.get(key);
        return entry ? entry.blob : null;
      }

      async set(key: string, data: CachePayload, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
        const blob = await payloadToBlob(data, metadata?.mimeType);
        const meta: CacheEntryMetadata = {
          checksum: metadata?.checksum || 'mock_hash',
          mimeType: metadata?.mimeType || blob.type || 'application/octet-stream',
          createdAt: metadata?.createdAt || Date.now(),
          sizeBytes: blob.size,
          metadata: metadata?.metadata,
        };
        this.store.set(key, { blob, metadata: meta });
      }

      async createWritableStream(key: string, metadata?: Partial<CacheEntryMetadata>): Promise<WritableStream<Uint8Array>> {
        const chunks: Uint8Array[] = [];
        return new WritableStream<Uint8Array>({
          write: (chunk) => { chunks.push(chunk); },
          close: async () => {
            const blob = new Blob(chunks, { type: metadata?.mimeType || 'application/octet-stream' });
            await this.set(key, blob, metadata);
          },
        });
      }

      async getMetadata(key: string): Promise<CacheEntryMetadata | null> {
        return this.store.get(key)?.metadata || null;
      }

      async delete(key: string): Promise<boolean> {
        return this.store.delete(key);
      }

      async clear(): Promise<void> {
        this.store.clear();
      }

      async getKeys(): Promise<string[]> {
        return Array.from(this.store.keys());
      }
    }

    it('stores, retrieves, checks, and deletes entries using first-class Blob in standardized strategy', async () => {
      const cache = new MockStandardCacheStrategy();
      const sampleBlob = new Blob(['hello-standard-cache'], { type: 'text/plain' });

      await cache.set('k1', sampleBlob);
      expect(await cache.has('k1')).toBe(true);

      const retrieved = await cache.get('k1');
      expect(retrieved).not.toBeNull();
      expect(retrieved instanceof Blob).toBe(true);
      expect(await retrieved!.text()).toBe('hello-standard-cache');

      // Test streaming consumption directly from Blob
      const stream = retrieved!.stream();
      expect(stream).toBeDefined();
      const bytes = await streamToUint8Array(stream);
      expect(new TextDecoder().decode(bytes)).toBe('hello-standard-cache');

      await cache.delete('k1');
      expect(await cache.has('k1')).toBe(false);
    });

    it('manages default and custom cache strategies via ContentCacheRegistry', async () => {
      const custom = new MockStandardCacheStrategy();
      ContentCacheRegistry.register(custom, true);

      expect(ContentCacheRegistry.hasStrategy('mock-storage')).toBe(true);
      expect(ContentCacheRegistry.getStrategy('mock-storage').id).toBe('mock-storage');
      expect(ContentCacheRegistry.getStrategy().id).toBe('mock-storage');
    });

    it('supports direct zero-copy streaming ingest via createWritableStream', async () => {
      const cache = new MockStandardCacheStrategy();
      const writable = await cache.createWritableStream('stream-key', { mimeType: 'text/plain' });

      const stream = payloadToStream('streaming-chunk-data');
      await stream.pipeTo(writable);

      expect(await cache.has('stream-key')).toBe(true);
      const retrieved = await cache.get('stream-key');
      expect(retrieved).not.toBeNull();
      expect(await retrieved!.text()).toBe('streaming-chunk-data');
    });
  });
});

