import {
  MediabunnyProbeStrategy,
  MediabunnyConcatStrategy,
  MediabunnyAudioMuxerStrategy,
} from './MediabunnyServerStrategy';
import { MediabunnyClientSink } from '../sinks/MediabunnyClientSink';
import type {
  IMediaEngineStrategy,
  MediaEngineType,
  MediaEngineCapabilities,
  IMediaFrameSink,
  IMediaProbeStrategy,
  IMediaConcatStrategy,
  IAudioMuxerStrategy,
  IChunkExecutionPolicy,
  SinkInitMetadata,
} from '../types';
import { MediaEngineError } from '../types';

export class MediabunnyClientChunkPolicy implements IChunkExecutionPolicy {
  public readonly supportsParallelExecution = true;
  public readonly executionMode = 'web-worker';

  public getOptimalConcurrency(totalChunks: number, systemCores: number): number {
    const cores = Math.max(1, systemCores || 4);
    return Math.min(totalChunks, cores);
  }
}

/**
 * Mediabunny Client Media Engine Strategy.
 * Designed for pure browser / WebCodecs environments (apps/studio) without requiring native binaries.
 */
export class MediabunnyClientStrategy implements IMediaEngineStrategy {
  public readonly id: MediaEngineType = 'mediabunny-client';
  public readonly name: string = 'Mediabunny Client Engine (WebCodecs & Browser Blob)';

  public readonly capabilities: MediaEngineCapabilities = {
    supportsZeroCopyFFI: false,
    supportsComplexFilters: false,
    supportsRawFrameStream: true,
    supportsBrowserRuntime: true,
    requiresNativeBinaries: false,
  };

  private probeStrategy = new MediabunnyProbeStrategy();
  private concatStrategy = new MediabunnyConcatStrategy();
  private audioMuxerStrategy = new MediabunnyAudioMuxerStrategy();
  private chunkPolicy = new MediabunnyClientChunkPolicy();

  public validatePrerequisites(): void {
    // In browser: check window.VideoEncoder. In Node/Bun: verify NodeAV/WebCodecs availability
    const hasBrowserWebCodecs = typeof globalThis !== 'undefined' && typeof (globalThis as any).VideoEncoder !== 'undefined';
    const hasNode = typeof process !== 'undefined' && process.versions != null;

    if (!hasBrowserWebCodecs && !hasNode) {
      throw new MediaEngineError(
        'mediabunny-client',
        'WebCodecs (VideoEncoder) is not supported in this runtime environment.'
      );
    }
  }

  public createVideoSink(options?: SinkInitMetadata): IMediaFrameSink {
    return new MediabunnyClientSink();
  }

  public getProbeStrategy(): IMediaProbeStrategy {
    return this.probeStrategy;
  }

  public getConcatStrategy(): IMediaConcatStrategy {
    return this.concatStrategy;
  }

  public getAudioMuxerStrategy(): IAudioMuxerStrategy {
    return this.audioMuxerStrategy;
  }

  public getChunkPolicy(): IChunkExecutionPolicy {
    return this.chunkPolicy;
  }
}
