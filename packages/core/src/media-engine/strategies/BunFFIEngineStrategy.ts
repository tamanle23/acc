import fs from 'fs';
import { FFmpegManager } from '../../FFmpegManager';
import { getMediaDurationFFI } from '../../ffmpeg-ffi';
import { FFIConcatMuxer } from '../../ffmpeg-ffi/FFIConcatMuxer';
import { FFAudioMuxer } from '../../ffmpeg-ffi/FFAudioMuxer';
import { FFIVideoEncoderSink } from '../sinks/FFIVideoEncoderSink';
import type {
  IMediaEngineStrategy,
  IMediaFrameSink,
  IMediaProbeStrategy,
  IMediaConcatStrategy,
  IAudioMuxerStrategy,
  IChunkExecutionPolicy,
  MediaEngineCapabilities,
  MediaProbeResult,
  SinkInitMetadata,
} from '../types';
import { MediaEngineError } from '../types';

export class BunFFIEngineStrategy implements IMediaEngineStrategy {
  public readonly id = 'bun-ffi';
  public readonly name = 'Native C bun:ffi Shared Library FFmpeg Engine';

  public readonly capabilities: MediaEngineCapabilities = {
    supportsZeroCopyFFI: true,
    supportsComplexFilters: false,
    supportsRawFrameStream: true,
    supportsBrowserRuntime: false,
    requiresNativeBinaries: true,
  };

  public validatePrerequisites(): void {
    if (typeof (globalThis as any).Bun === 'undefined') {
      throw new MediaEngineError('bun-ffi', 'bun:ffi engine requires the Bun runtime.');
    }
    try {
      FFmpegManager.getBinDir();
    } catch (err: any) {
      throw new MediaEngineError('bun-ffi', `Shared FFmpeg libraries not prepared: ${err.message}`);
    }
  }

  public createVideoSink(options?: SinkInitMetadata): IMediaFrameSink {
    return new FFIVideoEncoderSink();
  }

  public getProbeStrategy(): IMediaProbeStrategy {
    return {
      async probe(filePath: string): Promise<MediaProbeResult> {
        if (!fs.existsSync(filePath)) {
          throw new MediaEngineError('bun-ffi', `File not found for probing: ${filePath}`);
        }
        const duration = getMediaDurationFFI(filePath);
        return {
          durationSeconds: duration,
          hasAudio: true,
          hasVideo: true,
        };
      },
    };
  }

  public getConcatStrategy(): IMediaConcatStrategy {
    return {
      async concatenate(inputPaths: string[], outputPath: string): Promise<void> {
        await FFIConcatMuxer.concatenate(inputPaths, outputPath);
      },
    };
  }

  public getAudioMuxerStrategy(): IAudioMuxerStrategy {
    return {
      async muxAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
        await FFAudioMuxer.mux(videoPath, audioPath, outputPath);
      },
    };
  }

  public getChunkPolicy(): IChunkExecutionPolicy {
    return {
      supportsParallelExecution: true,
      executionMode: 'in-process',
      getOptimalConcurrency(totalChunks: number, systemCores: number): number {
        return Math.min(totalChunks, Math.max(1, systemCores), 8);
      },
    };
  }

  public async executeCommand(args: string[]): Promise<void> {
    // For arbitrary CLI filtergraphs, FFI cannot run arbitrary strings directly
    throw new MediaEngineError(
      'bun-ffi',
      'Arbitrary filter_complex CLI command execution is not supported by bun:ffi. Use fluent-ffmpeg engine.'
    );
  }
}
