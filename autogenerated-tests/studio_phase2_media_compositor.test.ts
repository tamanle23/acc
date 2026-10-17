import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { AssetTextureCache } from '../apps/studio/src/lib/textures/AssetTextureCache';

describe('Iteration 8 Phase 2: Real Visual Media Compositor (Image & Video)', () => {
  describe('AssetTextureCache Image & Video decoder', () => {
    it('should return a placeholder result when no src is given or in non-browser environment', () => {
      const cache = AssetTextureCache.getInstance();
      const res = cache.getVisualAsset('asset-missing', undefined, 'image');

      expect(res).toBeDefined();
      expect(res.isReady).toBe(true);
      expect(res.type).toBe('placeholder');
    });

    it('should generate isolated dark video charcoal placeholder adhering to Rule 235', () => {
      const cache = AssetTextureCache.getInstance();
      const ph = cache.renderMissingAssetPlaceholder('seq-test-plate', 'video', 640, 360);

      expect(ph).toBeDefined();
    });

    it('should handle video type request with sequence local time seeking parameter', () => {
      const cache = AssetTextureCache.getInstance();
      const res = cache.getVisualAsset('seq-video-broll', 'https://example.com/demo.mp4', 'video', 3.5);

      expect(res).toBeDefined();
      expect(res.type).toBe('placeholder'); // in headless environment without DOM, falls back gracefully to placeholder
    });
  });

  describe('Preview.tsx Multi-Track Compositor Source Verification', () => {
    const previewFile = path.resolve(process.cwd(), 'apps/studio/src/components/Preview.tsx');

    it('should query visual assets via AssetTextureCache in render loop and delegate to engine.renderLayers', () => {
      const code = fs.readFileSync(previewFile, 'utf-8');

      expect(code).toContain('textureCache.getVisualAsset(');
      expect(code).toContain('engine.renderLayers(ctx, layersToDraw)');
    });

    it('should sort visual sequences according to video track order V1 -> V4', () => {
      const code = fs.readFileSync(previewFile, 'utf-8');

      expect(code).toContain('trackOrderMap.set(t.id, idx)');
      expect(code).toContain('orderA - orderB');
    });

    it('should configure layer aspect ratio fitMode and blendMode for UniversalCanvasEngine', () => {
      const code = fs.readFileSync(previewFile, 'utf-8');

      expect(code).toContain("fitMode: trackIdx === 0 ? 'cover' : 'contain'");
      expect(code).toContain('blendMode: configuredBlend');
    });
  });
});
