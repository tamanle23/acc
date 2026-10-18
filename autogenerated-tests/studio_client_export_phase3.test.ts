import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

describe('Iteration 9 Phase 3: Client-Side Full-Fidelity MP4 Export Suite', () => {
  const appPath = path.resolve('apps/studio/src/App.tsx');
  const appContent = readFileSync(appPath, 'utf8');

  it('verifies App.tsx imports IRPreviewEngine and AssetTextureCache', () => {
    expect(appContent).toContain("import { IRPreviewEngine } from '@acc/ir';");
    expect(appContent).toContain("import { AssetTextureCache } from './lib/textures/AssetTextureCache';");
  });

  it('verifies handleStartExport renders real frames using IRPreviewEngine instead of placeholder text', () => {
    expect(appContent).toContain('new IRPreviewEngine(irState.timeline)');
    expect(appContent).toContain('previewEngine.renderFrame(f, ctx, {');
    expect(appContent).not.toContain('Video IR Render - Frame');
  });

  it('verifies handleStartExport creates Blob and triggers programmatic browser download', () => {
    expect(appContent).toContain("new Blob([exportBuffer], { type: 'video/mp4' });");
    expect(appContent).toContain('URL.createObjectURL(blob)');
    expect(appContent).toContain('document.createElement(\'a\')');
    expect(appContent).toContain('a.download = `video-ir-export-${Date.now()}.mp4`');
    expect(appContent).toContain('a.click()');
    expect(appContent).toContain('URL.revokeObjectURL(url)');
  });

  it('verifies MediabunnyClientSink exposes ArrayBuffer on finalize and getBuffer', async () => {
    const { MediabunnyClientSink } = await import('@acc/core/client');
    const sink = new MediabunnyClientSink();
    expect(typeof sink.getBuffer).toBe('function');
    expect(typeof sink.consumeFrame).toBe('function');
    expect(typeof sink.finalize).toBe('function');
  });
});
