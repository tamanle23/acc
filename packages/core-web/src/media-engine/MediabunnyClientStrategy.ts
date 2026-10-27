import { MediabunnyClientSink } from './MediabunnyClientSink';
import {
  IMediaEngineStrategy,
  MediaEngineType,
  MediaEngineCapabilities,
  IMediaFrameSink,
  IMediaProbeStrategy,
  IMediaConcatStrategy,
  IAudioMuxerStrategy,
  IChunkExecutionPolicy,
  MediaProbeResult,
  SinkInitMetadata,
} from '@acc/core-isomorphic';
import { MediaEngineError } from '@acc/core-isomorphic';

export class MediabunnyClientProbeStrategy implements IMediaProbeStrategy {
  public async probe(filePathOrUrl: string): Promise<MediaProbeResult> {
    throw new MediaEngineError(
      'mediabunny-client',
      `Client-side media probing for "${filePathOrUrl}" is not supported without a Web Blob/URL source.`
    );
  }
}

export class MediabunnyClientConcatStrategy implements IMediaConcatStrategy {
  public async concatenate(_inputPaths: string[], _outputPath: string): Promise<void> {
    throw new MediaEngineError(
      'mediabunny-client',
      'Lossless container concatenation of disk paths is unavailable in client browser runtime.'
    );
  }
}

export class MediabunnyClientAudioMuxerStrategy implements IAudioMuxerStrategy {
  public async muxAudioVideo(_videoPath: string, _audioPath: string, _outputPath: string): Promise<void> {
    throw new MediaEngineError(
      'mediabunny-client',
      'Direct container audio multiplexing via native FFI is unavailable in client browser runtime. Audio mixing is handled via WebAudio and MediabunnyClientSink.'
    );
  }
}

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
  public readonly id = MediaEngineType.MediabunnyClient;
  public readonly name: string = 'Mediabunny Client Engine (WebCodecs & Browser Blob)';

  public readonly capabilities: MediaEngineCapabilities = {
    supportsZeroCopyFFI: false,
    supportsComplexFilters: false,
    supportsRawFrameStream: true,
    supportsBrowserRuntime: true,
    requiresNativeBinaries: false,
  };

  private probeStrategy = new MediabunnyClientProbeStrategy();
  private concatStrategy = new MediabunnyClientConcatStrategy();
  private audioMuxerStrategy = new MediabunnyClientAudioMuxerStrategy();
  private chunkPolicy = new MediabunnyClientChunkPolicy();

  public validatePrerequisites(): void {
    // In browser: check window.VideoEncoder. In Node/Bun: verify NodeAV/WebCodecs availability
    const hasBrowserWebCodecs = typeof globalThis !== 'undefined' && typeof (globalThis as any).VideoEncoder !== 'undefined';
    const hasNode = typeof process !== 'undefined' && process.versions != null;

    if (!hasBrowserWebCodecs && !hasNode) {
      throw new MediaEngineError(
       this.id,
        'WebCodecs (VideoEncoder) is not supported in this runtime environment.'
      );
    }
  }

  public createVideoSink(_options?: SinkInitMetadata): IMediaFrameSink {
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
