import { describe, it, expect, beforeAll } from 'bun:test';
import { ContentCacheRegistry, UniversalCanvasProvider } from '@acc/core-isomorphic';
import { NapiCanvasAdapter, NativeFileCacheStrategy } from '@acc/core';
import {
  IRMasterRenderer,
  type ResolvedTimeline,
  type ResolvedTrack,
  createIsolatedCoreModifierPlugins,
} from '@acc/ir';

describe('IRMasterRenderer Pure Isomorphic & Universal Content Cache Integration', () => {
  beforeAll(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
  });
  it('preloads image asset directly from ContentCacheRegistry without disk access', async () => {
    // 1. Setup isolated native file cache
    const testStrategy = new NativeFileCacheStrategy({ maxBytes: 10 * 1024 * 1024 });
    ContentCacheRegistry.register(testStrategy, true);

    const assetKey = 'virtual://assets/test_overlay.png';
    // 1x1 transparent PNG byte array
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);

    await testStrategy.set(assetKey, new Blob([pngBytes], { type: 'image/png' }), { mimeType: 'image/png' });
    expect(await testStrategy.has(assetKey)).toBe(true);

    // 2. Build minimal timeline referencing this cached asset
    const track: ResolvedTrack = {
      id: 'track_1',
      name: 'Main Video',
      type: 'video',
      order: 0,
      sequences: [
        {
          id: 'seq_1',
          name: 'Seq 1',
          type: 'video',
          startFrame: 0,
          endFrame: 10,
          durationFrames: 10,
          timelineStartFrame: 0,
        },
      ],
    };

    const timeline: ResolvedTimeline = {
      id: 'cached-asset-timeline',
      version: '1.0.0',
      durationSeconds: 10 / 30,
      totalFrames: 10,
      meta: {
        canvasSize: { w: 320, h: 240 },
        globalFps: 30,
      },
      tracks: new Map([['track_1', track]]),
      sequences: new Map([['seq_1', track.sequences[0]]]),
      assets: {
        cached_img: {
          type: 'image',
          src: assetKey,
        },
      },
    };

    const renderer = new IRMasterRenderer(timeline, 42, createIsolatedCoreModifierPlugins());
    await renderer.preloadAssets();

    // Verify asset was loaded into imageCache
    expect((renderer as any).imageCache.has('cached_img')).toBe(true);
  });

  it('verifies IRMasterRenderer source code contains zero static fs, path, or crypto imports', async () => {
    const fsModule = await import('fs');
    const pathModule = await import('path');
    const rendererPath = pathModule.resolve(
      import.meta.dir,
      '../packages/ir/src/renderer/IRMasterRenderer.ts'
    );
    const content = fsModule.readFileSync(rendererPath, 'utf-8');

    // Asserts zero static imports of fs, path, or crypto
    expect(content).not.toMatch(/^\s*import\s+.*from\s+['"]fs['"]/m);
    expect(content).not.toMatch(/^\s*import\s+.*from\s+['"]node:fs['"]/m);
    expect(content).not.toMatch(/^\s*import\s+.*from\s+['"]path['"]/m);
    expect(content).not.toMatch(/^\s*import\s+.*from\s+['"]node:path['"]/m);
    expect(content).not.toMatch(/^\s*import\s+.*from\s+['"]crypto['"]/m);
    expect(content).not.toMatch(/^\s*import\s+.*from\s+['"]node:crypto['"]/m);

    // Asserts ContentCacheRegistry is imported
    expect(content).toContain('ContentCacheRegistry');
  });
});
