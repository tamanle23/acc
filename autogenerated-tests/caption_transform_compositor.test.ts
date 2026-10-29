import { describe, it, expect } from 'bun:test';
import { IRCanvasCompositor } from '../packages/ir/src/renderer/shared/IRCanvasCompositor';
import { ModifierPluginRegistry, registerCoreModifierPlugins } from '../packages/ir/src/plugins/ModifierPluginRegistry';
import type { ResolvedTimeline, ResolvedTrack } from '../packages/ir/src/types/VideoIR';

describe('Caption Transform Compositor & Timed Text Stacking Suite', () => {
  it('IRCanvasCompositor evaluates transform modifiers and textColor on timed_text sequences', async () => {
    let capturedTransformCalls: string[] = [];
    let saved = 0;
    let restored = 0;

    const mockCtx = {
      save: () => { saved++; },
      restore: () => { restored++; },
      translate: (x: number, y: number) => { capturedTransformCalls.push(`translate(${x},${y})`); },
      scale: (sx: number, sy: number) => { capturedTransformCalls.push(`scale(${sx},${sy})`); },
      rotate: (deg: number) => { capturedTransformCalls.push(`rotate(${deg})`); },
      clearRect: () => {},
      fillRect: () => {},
      drawImage: () => {},
      fillText: () => {},
      measureText: () => ({ width: 100 }),
      fillStyle: '#000000',
      globalAlpha: 1.0,
      globalCompositeOperation: 'source-over',
      font: '',
      textAlign: 'center',
      textBaseline: 'middle',
    } as any;

    const tracksMap = new Map<string, ResolvedTrack>();
    tracksMap.set('track-captions', {
      id: 'track-captions',
      name: 'Subtitles',
      type: 'timed_text',
      visible: true,
      muted: false,
      sequences: [
        {
          id: 'seq-caption-1',
          type: 'timed_text',
          startFrame: 0,
          durationFrames: 60,
          endFrame: 60,
          cues: [
            { text: 'Antigravity Studio', startOffsetMs: 0, endOffsetMs: 2000 },
          ],
          modifiers: [
            {
              type: 'transform',
              params: { x: 50, y: 100, scale: 1.2 },
            },
            {
              type: 'text/style',
              params: { textColor: '#38bdf8', fontSize: 32 },
            },
          ],
        } as any,
      ],
    } as any);

    const timeline: ResolvedTimeline = {
      meta: { globalFps: 30, canvasSize: { w: 1920, h: 1080 } },
      totalFrames: 120,
      tracks: tracksMap,
      sequences: new Map(),
    };

    const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());

    await IRCanvasCompositor.renderFrame(mockCtx, timeline, 10, {
      pluginRegistry: registry,
      clearColor: 'transparent',
    });

    // Check that ctx.save and ctx.restore were called for the transformed timed_text
    expect(saved).toBeGreaterThan(0);
    expect(restored).toBeGreaterThan(0);
    // Check that spatial transform translate was called
    expect(capturedTransformCalls.some((c) => c.startsWith('translate'))).toBe(true);
  });

  it('IRCanvasCompositor suppresses timed_text rendering when track is not visible', async () => {
    let textRendered = false;

    const mockCtx = {
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      clearRect: () => {},
      fillRect: () => {},
      drawImage: () => {},
      fillText: () => { textRendered = true; },
      measureText: () => ({ width: 100 }),
      fillStyle: '#000000',
      globalAlpha: 1.0,
      globalCompositeOperation: 'source-over',
    } as any;

    const tracksMap = new Map<string, ResolvedTrack>();
    tracksMap.set('track-captions-hidden', {
      id: 'track-captions-hidden',
      name: 'Hidden Subtitles',
      type: 'timed_text',
      visible: false, // Hidden track
      muted: false,
      sequences: [
        {
          id: 'seq-caption-hidden',
          type: 'timed_text',
          startFrame: 0,
          durationFrames: 60,
          endFrame: 60,
          cues: [
            { text: 'Hidden Text', startOffsetMs: 0, endOffsetMs: 2000 },
          ],
        } as any,
      ],
    } as any);

    const timeline: ResolvedTimeline = {
      meta: { globalFps: 30, canvasSize: { w: 1920, h: 1080 } },
      totalFrames: 120,
      tracks: tracksMap,
      sequences: new Map(),
    };

    const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());

    await IRCanvasCompositor.renderFrame(mockCtx, timeline, 10, {
      pluginRegistry: registry,
      clearColor: 'transparent',
    });

    expect(textRendered).toBe(false);
  });

  it('CanvasHitTester evaluates transformed subtitle bounding boxes accurately', () => {
    const { CanvasHitTester } = require('../apps/studio/src/lib/hit-test/CanvasHitTester');

    const mockSeq = {
      id: 'seq-caption-test',
      trackId: 'track-t1',
      type: 'timed_text',
      startFrame: 0,
      durationFrames: 60,
      endFrame: 60,
      cues: [{ text: 'Dynamic Subtitle Box', startOffsetMs: 0, endOffsetMs: 2000 }],
      modifiers: [
        {
          type: 'transform',
          params: { x: 192, y: 108, scale: 1.5 }, // 10% offset X, 10% offset Y, 1.5x scale
        },
      ],
    };

    const tracks = [{ id: 'track-t1', name: 'Text 1', type: 'timed_text', sequences: [mockSeq] }];

    const regions = CanvasHitTester.computeHitRegions([mockSeq as any], tracks as any);
    expect(regions.length).toBe(1);
    const region = regions[0];

    // normX should be 0.5 + 192 / 1920 = 0.60
    expect(region.normX).toBeCloseTo(0.60, 2);
    // scale should increase normWidth
    expect(region.normWidth).toBeGreaterThan(0.3);
  });
});
