import { describe, it, expect, beforeEach } from 'bun:test';
import { ContentHashTextureCache } from '../apps/studio/src/renderer/workers/ContentHashTextureCache';

describe('ContentHashTextureCache Suite', () => {
  let cache: ContentHashTextureCache;

  beforeEach(() => {
    cache = ContentHashTextureCache.getInstance();
    cache.clear();
  });

  it('generates consistent 32-bit FNV-1a hashes for text strings', () => {
    const hash1 = cache.hashString('Cyberpunk 2099:bold:32');
    const hash2 = cache.hashString('Cyberpunk 2099:bold:32');
    const hash3 = cache.hashString('Cyberpunk 2099:bold:36');

    expect(typeof hash1).toBe('number');
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('stores and retrieves cached ImageBitmaps via content hash', () => {
    let closed = false;
    const mockBitmap = {
      width: 100,
      height: 40,
      close: () => {
        closed = true;
      },
    } as unknown as ImageBitmap;

    const hash = cache.hashString('SAMPLE_TEXT');
    cache.set(hash, mockBitmap);

    expect(cache.has(hash)).toBe(true);
    expect(cache.get(hash)).toBe(mockBitmap);

    cache.clear();
    expect(cache.has(hash)).toBe(false);
    expect(closed).toBe(true);
  });
});
