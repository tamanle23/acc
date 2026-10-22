import { describe, it, expect, beforeAll } from 'bun:test';
import {
  IRCanvasCompositor,
  mapBlendModeToCanvasCompositeOperation,
  type IAssetSourceResolver,
  registerCoreModifierPlugins,
  ModifierPluginRegistry,
  type ResolvedTimeline,
  type ResolvedTrack,
  RelationalDAGCompiler,
  type VideoIRDocument,
} from '../packages/ir/src';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native';

describe('Iteration 27: Multi-Track Blending & Layer Isolation Architecture', () => {
  beforeAll(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter());
  });

  const pluginRegistry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());

  it('should correctly map all Video IR BlendModes to standard Canvas 2D operations', () => {
    expect(mapBlendModeToCanvasCompositeOperation('normal')).toBe('source-over');
    expect(mapBlendModeToCanvasCompositeOperation('screen')).toBe('screen');
    expect(mapBlendModeToCanvasCompositeOperation('multiply')).toBe('multiply');
    expect(mapBlendModeToCanvasCompositeOperation('overlay')).toBe('overlay');
    expect(mapBlendModeToCanvasCompositeOperation('add')).toBe('lighter');
    expect(mapBlendModeToCanvasCompositeOperation('color_dodge')).toBe('color-dodge');
    expect(mapBlendModeToCanvasCompositeOperation('soft_light')).toBe('soft-light');
    expect(mapBlendModeToCanvasCompositeOperation('lighten')).toBe('lighten');
    expect(mapBlendModeToCanvasCompositeOperation('darken')).toBe('darken');
    expect(mapBlendModeToCanvasCompositeOperation('difference')).toBe('difference');
    expect(mapBlendModeToCanvasCompositeOperation('exclusion')).toBe('exclusion');
    expect(mapBlendModeToCanvasCompositeOperation(undefined)).toBe('source-over');
  });

  it('should propagate track.blendMode and track.opacity through RelationalDAGCompiler', async () => {
    const doc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'compiler_track_blend_test',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track_bg',
          type: 'video',
          blendMode: 'normal',
          style: { opacity: 1.0 },
          sequences: [
            {
              id: 'seq_bg',
              type: 'video',
              time: { start: 0, duration: 60 },
            },
          ],
        },
        {
          id: 'track_overlay',
          type: 'video',
          blendMode: 'screen',
          style: { opacity: 0.8 },
          sequences: [
            {
              id: 'seq_overlay',
              type: 'video',
              time: { start: 0, duration: 60 },
            },
          ],
        },
      ],
    };

    const compiler = new RelationalDAGCompiler();
    const timeline = await compiler.compile(doc);

    const trackBg = timeline.tracks.get('track_bg');
    expect(trackBg).toBeDefined();
    expect(trackBg?.blendMode).toBe('normal');
    expect(trackBg?.opacity).toBe(1.0);

    const trackOverlay = timeline.tracks.get('track_overlay');
    expect(trackOverlay).toBeDefined();
    expect(trackOverlay?.blendMode).toBe('screen');
    expect(trackOverlay?.opacity).toBe(0.8);
  });

  it('should isolate tracks using scratch buffer when track.blendMode is non-normal in preview mode', () => {
    const tracks = new Map<string, ResolvedTrack>();

    tracks.set('track_v1', {
      id: 'track_v1',
      type: 'video',
      blendMode: 'normal',
      opacity: 1.0,
      sequences: [
        {
          id: 'seq_v1',
          type: 'video',
          trackId: 'track_v1',
          assetId: 'asset_red',
          startFrame: 0,
          endFrame: 30,
          durationFrames: 30,
        },
      ],
    });

    tracks.set('track_v2', {
      id: 'track_v2',
      type: 'video',
      blendMode: 'screen',
      opacity: 0.5,
      sequences: [
        {
          id: 'seq_v2',
          type: 'video',
          trackId: 'track_v2',
          assetId: 'asset_green',
          startFrame: 0,
          endFrame: 30,
          durationFrames: 30,
        },
      ],
    });

    const timeline: ResolvedTimeline = {
      meta: {
        contentId: 'scratch_isolation_test',
        globalFps: 30,
        canvasSize: { w: 100, h: 100 },
      },
      tracks,
      sequences: new Map(),
      totalFrames: 30,
      durationSeconds: 1.0,
    };

    // Create 100x100 solid color assets
    const redCanvas = UniversalCanvasProvider.createCanvas(100, 100);
    const redCtx = redCanvas.getContext('2d');
    redCtx.fillStyle = '#FF0000';
    redCtx.fillRect(0, 0, 100, 100);

    const greenCanvas = UniversalCanvasProvider.createCanvas(100, 100);
    const greenCtx = greenCanvas.getContext('2d');
    greenCtx.fillStyle = '#00FF00';
    greenCtx.fillRect(0, 0, 100, 100);

    const assetResolver: IAssetSourceResolver = {
      has: (id: string) => id === 'asset_red' || id === 'asset_green',
      get: (id: string) => (id === 'asset_red' ? redCanvas.getRawCanvas() : greenCanvas.getRawCanvas()),
    };

    const destCanvas = UniversalCanvasProvider.createCanvas(100, 100);
    const destCtx = destCanvas.getContext('2d');

    // Render with preview profile
    IRCanvasCompositor.renderFrame(destCtx, timeline, 15, {
      pluginRegistry,
      assetResolver,
      executionProfile: 'preview',
      clearColor: '#000000',
    });

    // Check pixel data at center (50, 50)
    const rawDest = destCanvas.getRawCanvas();
    const imgData = destCtx.getImageData(50, 50, 1, 1).data;

    // Base was Red [255, 0, 0].
    // Overlay was Green [0, 255, 0] with 'screen' and opacity 0.5.
    // Red channel should remain high (>= 200), Green should be blended in (> 0), Alpha must be 255
    expect(imgData[0]).toBeGreaterThan(200);
    expect(imgData[1]).toBeGreaterThan(0);
    expect(imgData[3]).toBe(255);
  });

  it('should support clearColor="transparent" without wiping alpha to opaque black', () => {
    const tracks = new Map<string, ResolvedTrack>();
    const timeline: ResolvedTimeline = {
      meta: {
        contentId: 'transparent_clear_test',
        globalFps: 30,
        canvasSize: { w: 10, h: 10 },
      },
      tracks,
      sequences: new Map(),
      totalFrames: 10,
      durationSeconds: 0.33,
    };

    const destCanvas = UniversalCanvasProvider.createCanvas(10, 10);
    const destCtx = destCanvas.getContext('2d');

    // Pre-fill canvas with white
    destCtx.fillStyle = '#FFFFFF';
    destCtx.fillRect(0, 0, 10, 10);

    // Render with transparent clear
    IRCanvasCompositor.renderFrame(destCtx, timeline, 0, {
      pluginRegistry,
      clearColor: 'transparent',
    });

    const pixel = destCtx.getImageData(0, 0, 1, 1).data;
    // R, G, B, A should all be 0 (fully transparent)
    expect(pixel[3]).toBe(0);
  });

  it('should execute strict layer isolation in master profile', () => {
    const tracks = new Map<string, ResolvedTrack>();

    tracks.set('track_v1', {
      id: 'track_v1',
      type: 'video',
      blendMode: 'normal',
      opacity: 1.0,
      sequences: [
        {
          id: 'seq_v1',
          type: 'video',
          trackId: 'track_v1',
          assetId: 'asset_blue',
          startFrame: 0,
          endFrame: 10,
          durationFrames: 10,
        },
      ],
    });

    const timeline: ResolvedTimeline = {
      meta: {
        contentId: 'master_profile_test',
        globalFps: 30,
        canvasSize: { w: 50, h: 50 },
      },
      tracks,
      sequences: new Map(),
      totalFrames: 10,
      durationSeconds: 0.33,
    };

    const blueCanvas = UniversalCanvasProvider.createCanvas(50, 50);
    const blueCtx = blueCanvas.getContext('2d');
    blueCtx.fillStyle = '#0000FF';
    blueCtx.fillRect(0, 0, 50, 50);

    const assetResolver: IAssetSourceResolver = {
      has: (id: string) => id === 'asset_blue',
      get: (id: string) => blueCanvas.getRawCanvas(),
    };

    const destCanvas = UniversalCanvasProvider.createCanvas(50, 50);
    const destCtx = destCanvas.getContext('2d');

    IRCanvasCompositor.renderFrame(destCtx, timeline, 5, {
      pluginRegistry,
      assetResolver,
      executionProfile: 'master',
      clearColor: '#000000',
    });

    const pixel = destCtx.getImageData(25, 25, 1, 1).data;
    expect(pixel[0]).toBe(0);
    expect(pixel[1]).toBe(0);
    expect(pixel[2]).toBe(255);
    expect(pixel[3]).toBe(255);
  });
});
