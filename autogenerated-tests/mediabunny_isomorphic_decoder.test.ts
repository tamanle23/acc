import { describe, it, expect } from 'bun:test';
import {
  AssetProtocolRegistry,
  CachedAssetBlob,
  BlobAssetBlob,
  HttpAssetBlob,
  DataUriAssetBlob,
  FileAssetBlob,
  type IVideoDecoder,
} from '@acc/core-isomorphic';
import {
  MediabunnyServerStrategy,
  MediabunnyVideoDecoder,
  resolveServerMediabunnySource,
} from '../packages/core/src/media-engine/strategies/MediabunnyServerStrategy';
import {
  MediabunnyClientStrategy,
  MediabunnyClientVideoDecoder,
  resolveClientMediabunnySource,
} from '../packages/core-web/src/media-engine/MediabunnyClientStrategy';

describe('Isomorphic Video Decoder Parity & Universal Asset Protocol Resolution', () => {
  describe('AssetProtocolRegistry Windows & URL Normalization', () => {
    const registry = AssetProtocolRegistry.getInstance();

    it('normalizes Windows file:///C:/path correctly without leading slash', () => {
      const asset = registry.resolve('file:///C:/projects/video.mp4') as FileAssetBlob;
      expect(asset).toBeInstanceOf(FileAssetBlob);
      expect(asset.filePath).toBe('C:/projects/video.mp4');
    });

    it('normalizes Unix file:///var/tmp/clip.mp4 correctly preserving leading slash', () => {
      const asset = registry.resolve('file:///var/tmp/clip.mp4') as FileAssetBlob;
      expect(asset).toBeInstanceOf(FileAssetBlob);
      expect(asset.filePath).toBe('/var/tmp/clip.mp4');
    });

    it('resolves cache:// and cache: protocol formats to CachedAssetBlob', () => {
      const asset1 = registry.resolve('cache://video-track-1') as CachedAssetBlob;
      expect(asset1).toBeInstanceOf(CachedAssetBlob);
      expect((asset1 as any).cacheKey).toBe('video-track-1');

      const asset2 = registry.resolve('cache:asset-uuid-123') as CachedAssetBlob;
      expect(asset2).toBeInstanceOf(CachedAssetBlob);
      expect((asset2 as any).cacheKey).toBe('asset-uuid-123');
    });

    it('resolves blob: URLs to BlobAssetBlob', () => {
      const asset = registry.resolve('blob:http://localhost:5173/abc-123') as BlobAssetBlob;
      expect(asset).toBeInstanceOf(BlobAssetBlob);
      expect(asset.uri).toBe('blob:http://localhost:5173/abc-123');
    });

    it('resolves http:// and https:// URLs to HttpAssetBlob', () => {
      const asset = registry.resolve('https://cdn.example.com/intro.mp4') as HttpAssetBlob;
      expect(asset).toBeInstanceOf(HttpAssetBlob);
      expect(asset.uri).toBe('https://cdn.example.com/intro.mp4');
    });

    it('resolves data: URIs to DataUriAssetBlob', () => {
      const base64Data = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
      const asset = registry.resolve(base64Data) as DataUriAssetBlob;
      expect(asset).toBeInstanceOf(DataUriAssetBlob);
      expect(asset.mimeType).toBe('text/plain');
    });
  });

  describe('Server & Client Strategy Parity for createVideoDecoder', () => {
    it('MediabunnyServerStrategy produces IVideoDecoder with full parity', () => {
      const serverStrategy = new MediabunnyServerStrategy();
      expect(typeof serverStrategy.createVideoDecoder).toBe('function');

      const decoder = serverStrategy.createVideoDecoder('test.mp4', 1920, 1080);
      expect(decoder).toBeInstanceOf(MediabunnyVideoDecoder);
      expect(decoder.width).toBe(1920);
      expect(decoder.height).toBe(1080);
      expect(typeof decoder.open).toBe('function');
      expect(typeof decoder.close).toBe('function');
      expect(typeof decoder.readNextFrame).toBe('function');
      expect(typeof decoder.seekTimestamp).toBe('function');
      expect(typeof (decoder as any)[Symbol.dispose]).toBe('function');
      expect(typeof (decoder as any)[Symbol.asyncDispose]).toBe('function');
    });

    it('MediabunnyClientStrategy produces IVideoDecoder with full parity', () => {
      const clientStrategy = new MediabunnyClientStrategy();
      expect(typeof clientStrategy.createVideoDecoder).toBe('function');

      const decoder = clientStrategy.createVideoDecoder('cache:track-1', 1280, 720);
      expect(decoder).toBeInstanceOf(MediabunnyClientVideoDecoder);
      expect(decoder.width).toBe(1280);
      expect(decoder.height).toBe(720);
      expect(typeof decoder.open).toBe('function');
      expect(typeof decoder.close).toBe('function');
      expect(typeof decoder.readNextFrame).toBe('function');
      expect(typeof decoder.seekTimestamp).toBe('function');
      expect(typeof (decoder as any)[Symbol.dispose]).toBe('function');
      expect(typeof (decoder as any)[Symbol.asyncDispose]).toBe('function');
    });
  });

  describe('Explicit Resource Management & Dual Disposal', () => {
    it('disposes server decoder synchronously via Symbol.dispose', () => {
      let closed = false;
      const decoder = new MediabunnyVideoDecoder('dummy.mp4', 1920, 1080);
      const originalClose = decoder.close.bind(decoder);
      decoder.close = () => {
        closed = true;
        originalClose();
      };

      decoder[Symbol.dispose]();
      expect(closed).toBe(true);
    });

    it('disposes server decoder asynchronously via Symbol.asyncDispose', async () => {
      let closed = false;
      const decoder = new MediabunnyVideoDecoder('dummy.mp4', 1920, 1080);
      const originalClose = decoder.close.bind(decoder);
      decoder.close = () => {
        closed = true;
        originalClose();
      };

      await decoder[Symbol.asyncDispose]();
      expect(closed).toBe(true);
    });

    it('disposes client decoder synchronously via Symbol.dispose', () => {
      let closed = false;
      const decoder = new MediabunnyClientVideoDecoder('dummy.mp4', 1920, 1080);
      const originalClose = decoder.close.bind(decoder);
      decoder.close = () => {
        closed = true;
        originalClose();
      };

      decoder[Symbol.dispose]();
      expect(closed).toBe(true);
    });

    it('disposes client decoder asynchronously via Symbol.asyncDispose', async () => {
      let closed = false;
      const decoder = new MediabunnyClientVideoDecoder('dummy.mp4', 1920, 1080);
      const originalClose = decoder.close.bind(decoder);
      decoder.close = () => {
        closed = true;
        originalClose();
      };

      await decoder[Symbol.asyncDispose]();
      expect(closed).toBe(true);
    });
  });

  describe('Fault Tolerance & Non-Strict Fallbacks', () => {
    it('returns false instead of throwing on non-existent source in non-strict mode (Server)', async () => {
      const decoder = new MediabunnyVideoDecoder('missing_clip.mp4', 1920, 1080, { strict: false });
      const ok = await decoder.open();
      expect(ok).toBe(false);
      expect(await decoder.readNextFrame()).toBeNull();
      expect(await decoder.seekTimestamp?.(2.5)).toBeNull();
      decoder.close();
    });

    it('returns false instead of throwing on non-existent source in non-strict mode (Client)', async () => {
      const decoder = new MediabunnyClientVideoDecoder('missing_clip.mp4', 1920, 1080, { strict: false });
      const ok = await decoder.open();
      expect(ok).toBe(false);
      expect(await decoder.readNextFrame()).toBeNull();
      expect(await decoder.seekTimestamp?.(2.5)).toBeNull();
      decoder.close();
    });

    it('throws structured error on invalid input in strict mode (Server)', async () => {
      const decoder = new MediabunnyVideoDecoder('missing_strict.mp4', 1920, 1080, { strict: true });
      expect(decoder.open()).rejects.toThrow();
    });

    it('throws structured error on invalid input in strict mode (Client)', async () => {
      const decoder = new MediabunnyClientVideoDecoder('missing_strict.mp4', 1920, 1080, { strict: true });
      expect(decoder.open()).rejects.toThrow();
    });
  });
});
