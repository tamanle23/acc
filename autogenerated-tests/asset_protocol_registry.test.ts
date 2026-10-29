import { describe, it, expect, beforeEach } from 'bun:test';
import {
  AssetProtocolRegistry,
  FileAssetBlob,
  HttpAssetBlob,
  BlobAssetBlob,
  DataUriAssetBlob,
  CachedAssetBlob,
  ContentCacheRegistry,
  CacheNamespace,
} from '../packages/core-isomorphic/src';
import { NativeFileCacheStrategy } from '../packages/core/src';

describe('Iteration 47: Isomorphic AssetProtocolRegistry & Universal Asset Loading', () => {
  beforeEach(async () => {
    if (!ContentCacheRegistry.hasStrategy('native-file')) {
      ContentCacheRegistry.register(new NativeFileCacheStrategy({ maxBytes: 10 * 1024 * 1024 }), true);
    }
    await ContentCacheRegistry.namespace(CacheNamespace.Assets).clear();
  });

  it('resolves http:// and https:// URIs into HttpAssetBlob', () => {
    const registry = AssetProtocolRegistry.getInstance();
    const asset = registry.resolve('https://example.com/assets/sample.png');
    expect(asset).toBeInstanceOf(HttpAssetBlob);
    expect(asset.mimeType).toBe('image/png');
    expect(asset.getNativePath()).toBeNull();
  });

  it('resolves blob: URIs into BlobAssetBlob', () => {
    const registry = AssetProtocolRegistry.getInstance();
    const asset = registry.resolve('blob:http://localhost:3000/1234-5678');
    expect(asset).toBeInstanceOf(BlobAssetBlob);
    expect(asset.getNativePath()).toBeNull();
  });

  it('resolves data: URIs into DataUriAssetBlob and parses binary bytes', async () => {
    const registry = AssetProtocolRegistry.getInstance();
    const sampleDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const asset = registry.resolve(sampleDataUri);
    expect(asset).toBeInstanceOf(DataUriAssetBlob);
    expect(asset.mimeType).toBe('image/png');

    const buf = await asset.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
    const blob = await asset.blob();
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(buf.byteLength);
  });

  it('resolves cache: URIs into CachedAssetBlob and transparently reads from ContentCacheRegistry', async () => {
    const registry = AssetProtocolRegistry.getInstance();
    const cacheKey = 'preloaded-test-texture';
    const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);

    const sampleBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    await cache.set(cacheKey, new Blob([sampleBytes], { type: 'image/webp' }));

    const asset = registry.resolve(`cache://${cacheKey}`);
    expect(asset).toBeInstanceOf(CachedAssetBlob);

    const blob = await asset.blob();
    expect(blob.size).toBe(8);
  });

  it('resolves local relative file paths and file:// URIs into FileAssetBlob', () => {
    const registry = AssetProtocolRegistry.getInstance();
    const asset1 = registry.resolve('file:///workspace/assets/bg.mp4');
    expect(asset1).toBeInstanceOf(FileAssetBlob);
    expect(asset1.mimeType).toBe('video/mp4');

    const asset2 = registry.resolve('./clips/intro.jpg', '/workspace/project');
    expect(asset2).toBeInstanceOf(FileAssetBlob);
    expect(asset2.mimeType).toBe('image/jpeg');
  });

  it('supports registering and executing custom protocol resolvers', () => {
    const registry = AssetProtocolRegistry.getInstance();
    registry.registerProtocol('custom-cdn', (uri) => {
      const path = uri.replace(/^custom-cdn:\/\//, '');
      return new HttpAssetBlob(`https://cdn.mycompany.internal/${path}`);
    });

    const asset = registry.resolve('custom-cdn://textures/skybox.png');
    expect(asset).toBeInstanceOf(HttpAssetBlob);
    expect((asset as HttpAssetBlob).uri).toBe('https://cdn.mycompany.internal/textures/skybox.png');
  });
});
