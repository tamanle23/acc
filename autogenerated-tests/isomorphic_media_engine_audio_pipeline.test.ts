import { describe, it, expect, beforeEach } from 'bun:test';
import {
  MediaEngineRegistry,
  type IMediaEngineStrategy,
  type IAudioDecoder,
  type DecodedAudioPCM,
  MediaEngineType,
} from '@acc/core-isomorphic';
import { UniversalAudioMixer } from '../packages/ir/src/renderer/audio/UniversalAudioMixer';
import { BunFFIEngineStrategy } from '../packages/core/src/media-engine/strategies/BunFFIEngineStrategy';
import { MediabunnyClientStrategy } from '../packages/core-web/src/media-engine/MediabunnyClientStrategy';
import { MediabunnyClientSink } from '../packages/core-web/src/media-engine/MediabunnyClientSink';
import { IRMasterRenderer } from '../packages/ir/src/renderer/IRMasterRenderer';
import type { ResolvedTimeline } from '../packages/ir/src/types/VideoIR';

describe('Isomorphic Audio Pipeline via MediaEngineStrategy & UniversalAudioMixer', () => {
  it('BunFFIEngineStrategy implements createAudioDecoder', () => {
    const strategy = new BunFFIEngineStrategy();
    expect(typeof strategy.createAudioDecoder).toBe('function');
    const decoder = strategy.createAudioDecoder!();
    expect(typeof decoder.decodeToPCM).toBe('function');
  });

  it('MediabunnyClientStrategy implements createAudioDecoder', () => {
    const strategy = new MediabunnyClientStrategy();
    expect(typeof strategy.createAudioDecoder).toBe('function');
    const decoder = strategy.createAudioDecoder!();
    expect(typeof decoder.decodeToPCM).toBe('function');
  });

  it('UniversalAudioMixer.decodeAsset delegates exclusively through MediaEngineRegistry', async () => {
    let mockDecodeCalled = false;
    const mockPcm: DecodedAudioPCM = {
      sampleRate: 48000,
      channels: 2,
      totalSamplesPerChannel: 100,
      durationSeconds: 100 / 48000,
      data: new Float32Array(200),
    };

    const mockStrategy: IMediaEngineStrategy = {
      id: MediaEngineRegistry.getDefaultEngine(),
      name: 'Mock Engine',
      capabilities: {
        supportsZeroCopyFFI: false,
        supportsComplexFilters: false,
        supportsRawFrameStream: true,
        supportsBrowserRuntime: true,
        requiresNativeBinaries: false,
      },
      validatePrerequisites: () => {},
      createVideoSink: () => ({} as any),
      createAudioDecoder: () => ({
        decodeToPCM: async (path: string) => {
          mockDecodeCalled = true;
          return mockPcm;
        },
      }),
      getProbeStrategy: () => ({} as any),
      getConcatStrategy: () => ({} as any),
      getAudioMuxerStrategy: () => ({} as any),
      getChunkPolicy: () => ({} as any),
    };

    MediaEngineRegistry.register(mockStrategy);

    const mixer = new UniversalAudioMixer([], 48000);
    const decoded = await mixer.decodeAsset('test-audio-path.mp3');

    expect(mockDecodeCalled).toBe(true);
    expect(decoded).not.toBeNull();
    expect(decoded?.totalSamplesPerChannel).toBe(100);

    // Caching check: Second call must return cached PCM without re-calling strategy
    mockDecodeCalled = false;
    const cachedDecoded = await mixer.decodeAsset('test-audio-path.mp3');
    expect(mockDecodeCalled).toBe(false);
    expect(cachedDecoded).toBe(decoded);
  });

  it('MediabunnyClientSink initialize is idempotent against double-initialization', async () => {
    const sink = new MediabunnyClientSink();
    expect(sink.isInitialized()).toBe(false);

    await sink.initialize({
      width: 320,
      height: 240,
      fps: 30,
      enableAudio: true,
    });

    expect(sink.isInitialized()).toBe(true);

    // Calling initialize a second time must NOT recreate output or wipe out audio track
    await sink.initialize({
      width: 640,
      height: 480,
      fps: 60,
    });

    expect(sink.isInitialized()).toBe(true);
  });

  it('IRMasterRenderer avoids double-initializing an already initialized sink', async () => {
    const timeline: ResolvedTimeline = {
      id: 'test-timeline',
      durationSeconds: 1,
      totalFrames: 30,
      tracks: new Map(),
      meta: {
        globalFps: 30,
        canvasSize: { w: 160, h: 120 },
      } as any,
    };

    let initCallCount = 0;
    const mockSink: any = {
      isInitialized: () => initCallCount > 0,
      initialize: async () => {
        initCallCount++;
      },
      consumeFrame: async () => {},
      finalize: async () => ({
        durationSeconds: 1,
        framesConsumed: 30,
        fileSizeBytes: 100,
        outputPath: 'out.mp4',
      }),
    };

    // Pre-initialize mock sink
    await mockSink.initialize();
    expect(initCallCount).toBe(1);

    const renderer = new IRMasterRenderer(timeline, 42);
    await renderer.render({
      sink: mockSink,
      skipAudio: true,
      yieldInterval: 100,
    });

    // Renderer should NOT have called initialize() again
    expect(initCallCount).toBe(1);
  });
});
