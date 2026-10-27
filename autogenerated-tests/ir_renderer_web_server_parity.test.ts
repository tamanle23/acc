import { describe, it, expect, beforeAll } from 'bun:test';
import { createHash } from 'crypto';
import {
  UniversalCanvasProvider,
} from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '@acc/core';
import {
  IRMasterRenderer,
  createIsolatedCoreModifierPlugins,
  type ResolvedTimeline,
  type ResolvedTrack,
} from '@acc/ir';
import { IRPreviewEngine } from '@acc/studio/renderer';

describe('Iteration 10 Phase 4: IR Master & Preview Web/Server Visual Parity Suite', () => {
  beforeAll(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
  });
  const WIDTH = 640;
  const HEIGHT = 360;
  const FPS = 30;
  const TOTAL_FRAMES = 60;
  const FRAMES_TO_VERIFY = [0, 15, 30, 45, 59];

  /**
   * Constructs a comprehensive multi-track synthetic timeline:
   * - Track 0: Base visual layer (V1)
   * - Track 1: Overlay visual layer (V2) with transform motion, rotation, scale, and screen blend mode
   * - Track 2: Timed-text track with karaoke word segments and safe-zone padding
   * - Track-level modifier: overlay/hologram_hud
   * - Document-level modifier: overlay/canvas_particles
   */
  function createParityTestTimeline(): ResolvedTimeline {
    const track0: ResolvedTrack = {
      id: 'track-v1-base',
      name: 'Base Video Layer',
      type: 'video',
      order: 0,
      sequences: [
        {
          id: 'seq-base',
          name: 'Base Sequence',
          type: 'video',
          startFrame: 0,
          endFrame: TOTAL_FRAMES,
          durationFrames: TOTAL_FRAMES,
          timelineStartFrame: 0,
          modifiers: [
            {
              type: 'transform',
              params: {
                x: 0,
                y: 0,
                scale: 1.0,
                rotation: 0,
                opacity: 1.0,
              },
            },
          ],
        },
      ],
    };

    const track1: ResolvedTrack = {
      id: 'track-v2-overlay',
      name: 'Overlay VFX Layer',
      type: 'video',
      order: 1,
      style: {
        blendMode: 'screen',
      },
      modifiers: [
        {
          type: 'overlay/hologram_hud',
          params: {
            ringRadius: 0.35,
            scanlineDensity: 24,
            rotationSpeed: 0.8,
            primaryColor: '#00ffff',
          },
        },
      ],
      sequences: [
        {
          id: 'seq-overlay',
          name: 'Overlay Hero Motion',
          type: 'video',
          startFrame: 10,
          endFrame: 50,
          durationFrames: 40,
          timelineStartFrame: 10,
          blendMode: 'screen',
          modifiers: [
            {
              type: 'transform',
              params: {
                x: 45,
                y: -25,
                scale: 1.2,
                rotation: 15,
                opacity: 0.9,
                animation: {
                  preset: 'bounce',
                  intro: { durationSec: 0.5, ease: 'bounce.out' },
                  steady: { type: 'pulse', speed: 1.5, amplitude: 0.1 },
                  outro: { durationSec: 0.4, ease: 'power2.in' },
                },
              },
            },
          ],
        },
      ],
    };

    const track2Subtitles: ResolvedTrack = {
      id: 'track-timed-text',
      name: 'Subtitles & Captions',
      type: 'timed_text',
      order: 2,
      sequences: [
        {
          id: 'seq-sub-1',
          name: 'Subtitle Line 1',
          type: 'timed_text',
          startFrame: 5,
          endFrame: 55,
          durationFrames: 50,
          timelineStartFrame: 5,
          modifiers: [
            {
              type: 'text/style',
              params: {
                text: 'PARITY VERIFICATION PROTOCOL ACTIVE',
                fontFamily: 'sans-serif',
                fontSize: 28,
                textColor: '#ffffff',
                highlightColor: '#00ffcc',
                platform: 'youtube',
                words: [
                  { word: 'PARITY', start: 0.2, end: 0.5 },
                  { word: 'VERIFICATION', start: 0.5, end: 0.9 },
                  { word: 'PROTOCOL', start: 0.9, end: 1.3 },
                  { word: 'ACTIVE', start: 1.3, end: 1.8 },
                ],
              },
            },
          ],
        },
      ],
    };

    const timeline: ResolvedTimeline = {
      id: 'parity-test-timeline',
      version: '1.0.0',
      durationSeconds: TOTAL_FRAMES / FPS,
      totalFrames: TOTAL_FRAMES,
      meta: {
        canvasSize: { w: WIDTH, h: HEIGHT },
        globalFps: FPS,
      },
      tracks: new Map([
        ['track-v1-base', track0],
        ['track-v2-overlay', track1],
        ['track-timed-text', track2Subtitles],
      ]),
      sequences: new Map([
        ['seq-base', track0.sequences[0]],
        ['seq-overlay', track1.sequences[0]],
        ['seq-sub-1', track2Subtitles.sequences[0]],
      ]),
      modifiers: [
        {
          type: 'overlay/canvas_particles',
          params: {
            particleCount: 40,
            colorPalette: ['#00ffff', '#ffffff'],
            motionPattern: 'radial_blast',
            compositeOperation: 'lighter',
            speed: 1.0,
          },
        },
      ],
    };

    return timeline;
  }

  it('generates 100% bit-identical cryptographic SHA-256 hashes between IRMasterRenderer and IRPreviewEngine', async () => {
    UniversalCanvasProvider.setEngine('node');
    const timeline = createParityTestTimeline();

    // 1. Render all frames using IRMasterRenderer
    const masterPlugins = createIsolatedCoreModifierPlugins();
    const masterRenderer = new IRMasterRenderer(timeline, 42, masterPlugins);
    const masterResult = await masterRenderer.render({
      generateFrameHash: true,
      skipAudio: true,
    });

    expect(masterResult.frameHashes).toBeDefined();
    expect(masterResult.frameHashes?.length).toBe(TOTAL_FRAMES);

    // 2. Render target verification frames using IRPreviewEngine
    const previewPlugins = createIsolatedCoreModifierPlugins();
    const previewEngine = new IRPreviewEngine(timeline, previewPlugins);

    const canvasInstance = UniversalCanvasProvider.createCanvas(WIDTH, HEIGHT);
    const canvas = canvasInstance.getRawCanvas ? canvasInstance.getRawCanvas() : canvasInstance;
    const ctx = canvas.getContext('2d');

    const previewPixelBuffer = new Uint8Array(WIDTH * HEIGHT * 4);

    for (const frame of FRAMES_TO_VERIFY) {
      // PreviewEngine render
      previewEngine.renderFrame(frame, ctx, { clearColor: '#000000' });

      // Extract pixel buffer from preview canvas
      if (typeof canvas.data === 'function') {
        previewPixelBuffer.set(canvas.data());
      } else {
        const imgData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
        previewPixelBuffer.set(imgData.data);
      }

      // Compute SHA-256 hash of the preview frame buffer
      const previewHash = createHash('sha256').update(previewPixelBuffer).digest('hex');
      const expectedMasterHash = masterResult.frameHashes![frame];

      // Cryptographic bit-identical verification
      expect(previewHash).toBe(expectedMasterHash);
    }
  });

  it('guarantees zero pixel delta (pixel-diff delta === 0) across all RGBA channels between both engines', async () => {
    UniversalCanvasProvider.setEngine('node');
    const timeline = createParityTestTimeline();

    const masterPlugins = createIsolatedCoreModifierPlugins();
    const masterRenderer = new IRMasterRenderer(timeline, 42, masterPlugins);

    const previewPlugins = createIsolatedCoreModifierPlugins();
    const previewEngine = new IRPreviewEngine(timeline, previewPlugins);

    const canvasInstance = UniversalCanvasProvider.createCanvas(WIDTH, HEIGHT);
    const canvas = canvasInstance.getRawCanvas ? canvasInstance.getRawCanvas() : canvasInstance;
    const ctx = canvas.getContext('2d');

    // Create a mock frame sink to capture raw frame buffers directly from IRMasterRenderer
    const masterCapturedFrames = new Map<number, Uint8Array>();
    const mockSink = {
      initialize: async () => { },
      prepare: async () => { },
      consumeFrame: async (frameIndex: number, rgbaBuffer: Uint8Array) => {
        if (FRAMES_TO_VERIFY.includes(frameIndex)) {
          masterCapturedFrames.set(frameIndex, new Uint8Array(rgbaBuffer));
        }
      },
      finalize: async () => ({ outputPath: '', byteSize: 0, frameCount: TOTAL_FRAMES }),
    };

    await masterRenderer.render({
      sink: mockSink,
      skipAudio: true,
    });

    const previewPixelBuffer = new Uint8Array(WIDTH * HEIGHT * 4);

    for (const frame of FRAMES_TO_VERIFY) {
      previewEngine.renderFrame(frame, ctx, { clearColor: '#000000' });

      if (typeof canvas.data === 'function') {
        previewPixelBuffer.set(canvas.data());
      } else {
        const imgData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
        previewPixelBuffer.set(imgData.data);
      }

      const masterBuffer = masterCapturedFrames.get(frame);
      expect(masterBuffer).toBeDefined();

      // Absolute pixel-diff comparison across all 4 channels (R, G, B, A)
      let diffCount = 0;
      let maxDelta = 0;

      for (let i = 0; i < previewPixelBuffer.length; i++) {
        const delta = Math.abs(previewPixelBuffer[i] - masterBuffer![i]);
        if (delta > 0) {
          diffCount++;
          if (delta > maxDelta) maxDelta = delta;
        }
      }

      expect(diffCount).toBe(0);
      expect(maxDelta).toBe(0);
    }
  });

  it('confirms temporal variance and non-static rendering across distinct time slices', async () => {
    UniversalCanvasProvider.setEngine('node');
    const timeline = createParityTestTimeline();

    const previewPlugins = createIsolatedCoreModifierPlugins();
    const previewEngine = new IRPreviewEngine(timeline, previewPlugins);

    const canvasInstance = UniversalCanvasProvider.createCanvas(WIDTH, HEIGHT);
    const canvas = canvasInstance.getRawCanvas ? canvasInstance.getRawCanvas() : canvasInstance;
    const ctx = canvas.getContext('2d');

    const hashes = new Set<string>();
    const previewPixelBuffer = new Uint8Array(WIDTH * HEIGHT * 4);

    for (const frame of [0, 15, 30, 45]) {
      previewEngine.renderFrame(frame, ctx, { clearColor: '#000000' });

      if (typeof canvas.data === 'function') {
        previewPixelBuffer.set(canvas.data());
      } else {
        const imgData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
        previewPixelBuffer.set(imgData.data);
      }

      const hash = createHash('sha256').update(previewPixelBuffer).digest('hex');
      hashes.add(hash);
    }

    // Every distinct time slice must produce a visually distinct rendered frame
    expect(hashes.size).toBe(4);
  });
});
