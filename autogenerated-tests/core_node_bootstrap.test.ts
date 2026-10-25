import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  UniversalCanvasProvider,
  MediaEngineRegistry,
  ContentCacheRegistry,
} from '@acc/core-isomorphic';
import {
  bootstrapNode,
  NapiCanvasAdapter,
  NativeFileCacheStrategy,
  BunFFIEngineStrategy,
  MediabunnyServerStrategy,
  FluentFFmpegEngineStrategy,
} from '../packages/core/src';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('Phase 4: Node/Bun Runtime Bootstrap Suite (@acc/core)', () => {
  const testCacheDir = path.join(os.tmpdir(), `test-bootstrap-node-${Date.now()}`);

  beforeEach(() => {
    UniversalCanvasProvider.unregisterAll();
    MediaEngineRegistry.reset();
    ContentCacheRegistry.reset();
  });

  afterEach(async () => {
    if (fs.existsSync(testCacheDir)) {
      try {
        await fs.promises.rm(testCacheDir, { recursive: true, force: true });
      } catch {}
    }
  });

  describe('bootstrapNode() Invariants & Registration', () => {
    it('registers NapiCanvasAdapter as the default canvas adapter', async () => {
      expect(() => UniversalCanvasProvider.getAdapter()).toThrow();

      await bootstrapNode();

      const adapter = UniversalCanvasProvider.getAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.name).toBe('node-napi-rs');
      expect(adapter.environment).toBe('node');
      expect(adapter).toBeInstanceOf(NapiCanvasAdapter);
    });

    it('registers NativeFileCacheStrategy with ContentCacheRegistry', async () => {
      expect(ContentCacheRegistry.has('native-file')).toBe(false);

      await bootstrapNode({
        cacheOptions: { baseDir: testCacheDir },
      });

      expect(ContentCacheRegistry.has('native-file')).toBe(true);
      const defaultCache = ContentCacheRegistry.get();
      expect(defaultCache.id).toBe('native-file');
      expect(defaultCache).toBeInstanceOf(NativeFileCacheStrategy);

      // Verify basic cache operations through registered strategy
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      await defaultCache.set('bootstrap-test-key', testData, { mimeType: 'application/octet-stream' });
      expect(await defaultCache.has('bootstrap-test-key')).toBe(true);
      const retrieved = await defaultCache.get('bootstrap-test-key');
      expect(retrieved).toEqual(testData);
    });

    it('registers all Node/Bun server media engine strategies', async () => {
      expect(MediaEngineRegistry.has('bun-ffi')).toBe(false);
      expect(MediaEngineRegistry.has('mediabunny-server')).toBe(false);
      expect(MediaEngineRegistry.has('fluent-ffmpeg')).toBe(false);

      await bootstrapNode();

      expect(MediaEngineRegistry.has('bun-ffi')).toBe(true);
      expect(MediaEngineRegistry.has('mediabunny-server')).toBe(true);
      expect(MediaEngineRegistry.has('fluent-ffmpeg')).toBe(true);

      const available = MediaEngineRegistry.listAvailable();
      expect(available).toContain('bun-ffi');
      expect(available).toContain('mediabunny-server');
      expect(available).toContain('fluent-ffmpeg');

      expect(MediaEngineRegistry.get('mediabunny-server')).toBeInstanceOf(MediabunnyServerStrategy);
    });

    it('allows specifying defaultMediaEngine option', async () => {
      await bootstrapNode({ defaultMediaEngine: 'mediabunny-server' });

      expect(MediaEngineRegistry.getDefaultEngine()).toBe('mediabunny-server');
      expect(MediaEngineRegistry.get().id).toBe('mediabunny-server');
    });

    it('is idempotent across multiple calls', async () => {
      await bootstrapNode();
      await bootstrapNode();
      await bootstrapNode();

      expect(UniversalCanvasProvider.getAdapter().name).toBe('node-napi-rs');
      expect(ContentCacheRegistry.has('native-file')).toBe(true);
      expect(MediaEngineRegistry.has('bun-ffi')).toBe(true);
      expect(MediaEngineRegistry.has('mediabunny-server')).toBe(true);
      expect(MediaEngineRegistry.has('fluent-ffmpeg')).toBe(true);
    });

    it('prepares FFmpeg when prepareFFmpeg is set to true', async () => {
      await bootstrapNode({ prepareFFmpeg: true });
      expect(UniversalCanvasProvider.getAdapter().name).toBe('node-napi-rs');

      // Now fluent-ffmpeg and bun-ffi validatePrerequisites can succeed without throwing
      expect(MediaEngineRegistry.get('fluent-ffmpeg')).toBeInstanceOf(FluentFFmpegEngineStrategy);
      expect(MediaEngineRegistry.get('bun-ffi')).toBeInstanceOf(BunFFIEngineStrategy);
    });
  });
});
