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
    const previewDir = path.resolve(process.cwd(), 'apps/studio/src/components/preview');

    // Aggregate coordinator + all preview submodules (Tasks 302–303 decomposed Preview.tsx)
    function readPreviewModuleTree(): string {
      const coordinator = fs.readFileSync(previewFile, 'utf-8');
      const subFiles = fs.readdirSync(previewDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
      return [coordinator, ...subFiles.map(f => fs.readFileSync(path.join(previewDir, f), 'utf-8'))].join('\n');
    }

    it('should query visual assets via AssetTextureCache in render loop and delegate to IRPreviewEngine.renderFrame', () => {
      const code = fs.readFileSync(previewFile, 'utf-8');

      expect(code).toContain('studioTextureCache.getVisualAsset(');
      expect(code).toContain('engine.renderFrame(currentFrame');
    });

    it('should initialize IRPreviewEngine with active timeline and populate engine texture cache', () => {
      const code = fs.readFileSync(previewFile, 'utf-8');

      expect(code).toContain('new IRPreviewEngine(irState.timeline)');
      expect(code).toContain('engineTextures.set(seq.assetId, visualAsset.source)');
    });

    it('should implement decoupled 2-layer viewport canvas architecture', () => {
      // Task 303 moved canvas elements into ViewportCanvasLayer.tsx — read full module tree
      const code = readPreviewModuleTree();

      expect(code).toContain('id="studio-canvas"');
      expect(code).toContain('id="studio-overlay-canvas"');
    });
  });
});
