import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import {
  MediaEngineRegistry,
  BunFFIEngineStrategy,
  FluentFFmpegEngineStrategy,
  MediaEngineError,
  FFmpegManager,
  type IMediaEngineStrategy,
  type SinkInitMetadata,
  type IMediaFrameSink,
  type IMediaProbeStrategy,
  type IMediaConcatStrategy,
  type IAudioMuxerStrategy,
  type IChunkExecutionPolicy,
} from '@acc/core';

describe('MediaEngineRegistry', () => {
  beforeAll(async () => {
    await FFmpegManager.prepare();
  });

  beforeEach(() => {
    MediaEngineRegistry.reset();
    MediaEngineRegistry.register(new BunFFIEngineStrategy());
    MediaEngineRegistry.register(new FluentFFmpegEngineStrategy());
  });

  it('should default to bun-ffi strategy', () => {
    expect(MediaEngineRegistry.getDefaultEngine()).toBe('bun-ffi');
    const strategy = MediaEngineRegistry.get();
    expect(strategy.id).toBe('bun-ffi');
    expect(strategy.name).toContain('bun:ffi');
  });

  it('should resolve fluent-ffmpeg when explicitly requested', () => {
    const strategy = MediaEngineRegistry.get('fluent-ffmpeg');
    expect(strategy.id).toBe('fluent-ffmpeg');
    expect(strategy.name).toContain('FFmpeg Subprocess');
  });

  it('should allow changing default engine', () => {
    MediaEngineRegistry.setDefaultEngine('fluent-ffmpeg');
    expect(MediaEngineRegistry.getDefaultEngine()).toBe('fluent-ffmpeg');
    const strategy = MediaEngineRegistry.get();
    expect(strategy.id).toBe('fluent-ffmpeg');
  });

  it('should fail fast with MediaEngineError when requesting unregistered strategy', () => {
    expect(() => {
      MediaEngineRegistry.get('mediabunny-server' as any);
    }).toThrow(MediaEngineError);
  });

  it('should support lazy strategy registration and retrieval', async () => {
    const mockStrategy: IMediaEngineStrategy = {
      id: 'mediabunny-server',
      name: 'Mock Mediabunny Server',
      capabilities: {
        supportsZeroCopyFFI: false,
        supportsComplexFilters: false,
        supportsRawFrameStream: true,
        supportsBrowserRuntime: false,
        requiresNativeBinaries: false,
      },
      validatePrerequisites: () => {},
      createVideoSink: () => ({} as any),
      getProbeStrategy: () => ({} as any),
      getConcatStrategy: () => ({} as any),
      getAudioMuxerStrategy: () => ({} as any),
      getChunkPolicy: () => ({} as any),
    };

    MediaEngineRegistry.registerLazy('mediabunny-server', async () => mockStrategy);

    expect(MediaEngineRegistry.has('mediabunny-server')).toBe(true);
    const resolved = await MediaEngineRegistry.getAsync('mediabunny-server');
    expect(resolved.id).toBe('mediabunny-server');
    expect(resolved.name).toBe('Mock Mediabunny Server');
  });

  it('should enforce strict prerequisite validation on resolution', () => {
    const invalidStrategy: IMediaEngineStrategy = {
      id: 'mediabunny-client',
      name: 'Invalid Prerequisite Engine',
      capabilities: {
        supportsZeroCopyFFI: false,
        supportsComplexFilters: false,
        supportsRawFrameStream: false,
        supportsBrowserRuntime: true,
        requiresNativeBinaries: false,
      },
      validatePrerequisites: () => {
        throw new MediaEngineError('mediabunny-client', 'Prerequisite missing: window.VideoEncoder not found');
      },
      createVideoSink: () => ({} as any),
      getProbeStrategy: () => ({} as any),
      getConcatStrategy: () => ({} as any),
      getAudioMuxerStrategy: () => ({} as any),
      getChunkPolicy: () => ({} as any),
    };

    MediaEngineRegistry.register(invalidStrategy);

    expect(() => {
      MediaEngineRegistry.get('mediabunny-client');
    }).toThrow(MediaEngineError);
  });
});
