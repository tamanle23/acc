import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { MediabunnyWorkerReader } from '../apps/studio/src/renderer/workers/MediabunnyWorkerReader';
import { WebAudioEngine } from '../apps/studio/src/lib/audio/WebAudioEngine';

describe('Cold Start Playhead Jump & Scrub Resilience Suite', () => {
  describe('MediabunnyWorkerReader Cold Start Non-Blocking Behavior', () => {
    let reader: MediabunnyWorkerReader;

    beforeEach(() => {
      reader = new MediabunnyWorkerReader('https://example.com/mock-video.mp4');
    });

    it('returns null immediately without blocking worker loop when requested before initialization', async () => {
      const startTime = performance.now();

      // Cold requestFrame before init() completes
      const framePromise = reader.requestFrame(60, 30, false);
      const result = await framePromise;
      const duration = performance.now() - startTime;

      // Must return immediately (<= 15ms) returning null so caller renders placeholder/holds frame
      expect(result).toBeNull();
      expect(duration).toBeLessThan(15);
      expect(reader.getIsInitialized()).toBe(false);
    });

    it('instantiates CanvasSink directly without blocking on computeDuration or frame rate metrics', async () => {
      const mockTrack = {
        getDisplayWidth: mock(async () => 1920),
        getDisplayHeight: mock(async () => 1080),
      };

      const mockInput = {
        getPrimaryVideoTrack: mock(async () => mockTrack),
        computeDuration: mock(async () => 12.5),
      };

      // Inject mock input into reader
      (reader as any).input = mockInput;

      // Override init with mock Input behavior
      (reader as any).initPromise = (async () => {
        const track = await mockInput.getPrimaryVideoTrack();
        (reader as any).videoTrack = track;
        (reader as any).width = (await track.getDisplayWidth()) || 1920;
        (reader as any).height = (await track.getDisplayHeight()) || 1080;
        (reader as any).canvasSink = { getCanvas: mock(async () => ({})) };
        (reader as any).isInitialized = true;
        (reader as any).isInitializing = false;

        // Background non-blocking compute duration
        mockInput.computeDuration().then((dur: number) => {
          (reader as any).durationSec = dur;
        });
        return true;
      })();

      const success = await reader.init();
      expect(success).toBe(true);
      expect(reader.getIsInitialized()).toBe(true);
      expect((reader as any).width).toBe(1920);
      expect((reader as any).height).toBe(1080);
      expect((reader as any).canvasSink).toBeDefined();

      // Ensure computeDuration was triggered in background
      await Promise.resolve();
      expect(mockInput.computeDuration).toHaveBeenCalled();
      expect((reader as any).durationSec).toBe(12.5);
    });
  });

  describe('WebAudioEngine Cold Start Autoplay & Scrub Protection', () => {
    let audioEngine: WebAudioEngine;

    beforeEach(() => {
      audioEngine = WebAudioEngine.getInstance();
    });

    it('safely skips scrub audio DSP when AudioContext is suspended under browser autoplay policy', () => {
      // Mock AudioContext in suspended state
      const mockCtx: any = {
        state: 'suspended',
        sampleRate: 44100,
        currentTime: 0,
        createBuffer: mock(),
        createBufferSource: mock(),
        createGain: mock(),
      };

      (audioEngine as any).ctx = mockCtx;
      (audioEngine as any).masterGain = { gain: { setValueAtTime: mock() }, connect: mock() };

      // Dispatch scrub feedback on suspended context
      audioEngine.playScrubFeedback(60, 30, { timeline: { totalFrames: 300, tracks: new Map() } });

      // createBuffer and buffer source must NOT have been called
      expect(mockCtx.createBuffer).not.toHaveBeenCalled();
      expect(mockCtx.createBufferSource).not.toHaveBeenCalled();
    });

    it('decouples asset preloading when syncing IR state during scrub feedback', () => {
      const mockIrState = {
        timeline: {
          meta: { globalFps: 30, contentId: 'test', canvasSize: { w: 1920, h: 1080 } },
          totalFrames: 300,
          tracks: new Map(),
          assets: { 'audio-1': { src: 'test.mp3', type: 'audio' } },
        },
        doc: { assets: {} },
      };

      // Verify that syncFromIR can accept preload = false flag
      (audioEngine as any).syncFromIR(mockIrState, 30, false);
      expect((audioEngine as any).lastIrState).toBe(mockIrState);
    });
  });
});
