import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { FFmpegManager } from '../../FFmpegManager';
import { FluentPipeVideoSink } from '../sinks/FluentPipeVideoSink';
import {
  IMediaEngineStrategy,
  IMediaFrameSink,
  IMediaProbeStrategy,
  IMediaConcatStrategy,
  IAudioMuxerStrategy,
  IChunkExecutionPolicy,
  MediaEngineCapabilities,
  MediaProbeResult,
  SinkInitMetadata,
  MediaEngineError,
  MediaEngineType
} from '@acc/core-isomorphic';

export class FluentFFmpegEngineStrategy implements IMediaEngineStrategy {
  public readonly id = MediaEngineType.FluentFFmpeg;
  public readonly name = 'CLI-Isolated FFmpeg Subprocess Engine (Bun.spawn)';

  public readonly capabilities: MediaEngineCapabilities = {
    supportsZeroCopyFFI: false,
    supportsComplexFilters: true,
    supportsRawFrameStream: true,
    supportsBrowserRuntime: false,
    requiresNativeBinaries: true,
  };

  public validatePrerequisites(): void {
    let ffmpegPath: string;
    try {
      ffmpegPath = FFmpegManager.getFFmpegPath();
    } catch (err: any) {
      throw new MediaEngineError(MediaEngineType.FluentFFmpeg, `FFmpeg binary not prepared: ${err.message}`);
    }

    if (!fs.existsSync(ffmpegPath)) {
      throw new MediaEngineError(MediaEngineType.FluentFFmpeg, `FFmpeg binary not found at resolved path: ${ffmpegPath}`);
    }
  }

  public createVideoSink(options?: SinkInitMetadata): IMediaFrameSink {
    return new FluentPipeVideoSink();
  }

  public getProbeStrategy(): IMediaProbeStrategy {
    return {
      async probe(filePath: string): Promise<MediaProbeResult> {
        if (!fs.existsSync(filePath)) {
          throw new MediaEngineError(MediaEngineType.FluentFFmpeg, `File not found for probing: ${filePath}`);
        }

        const ffprobePath = FFmpegManager.getFFprobePath();
        const args = [
          ffprobePath,
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          filePath,
        ];

        try {
          const proc = (Bun as any).spawn(args, { stdout: 'pipe', stderr: 'pipe' });
          const stdoutText = await new Response(proc.stdout).text();
          const exitCode = await proc.exited;

          if (exitCode !== 0) {
            const stderrText = await new Response(proc.stderr).text();
            throw new Error(`ffprobe failed with exit code ${exitCode}: ${stderrText}`);
          }

          const parsed = JSON.parse(stdoutText);
          const format = parsed.format || {};
          const streams = parsed.streams || [];

          const videoStream = streams.find((s: any) => s.codec_type === 'video');
          const audioStream = streams.find((s: any) => s.codec_type === 'audio');

          let fps: number | undefined;
          if (videoStream?.r_frame_rate) {
            const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
            if (den && den > 0) fps = Math.round((num / den) * 100) / 100;
          }

          return {
            durationSeconds: parseFloat(format.duration || '0'),
            width: videoStream?.width ? parseInt(videoStream.width, 10) : undefined,
            height: videoStream?.height ? parseInt(videoStream.height, 10) : undefined,
            fps,
            codecVideo: videoStream?.codec_name,
            codecAudio: audioStream?.codec_name,
            bitrateKbps: format.bit_rate ? Math.round(parseInt(format.bit_rate, 10) / 1000) : undefined,
            hasAudio: !!audioStream,
            hasVideo: !!videoStream,
          };
        } catch (err: any) {
          throw new MediaEngineError(MediaEngineType.FluentFFmpeg, `Failed to probe file ${filePath}: ${err.message}`);
        }
      },
    };
  }

  public getConcatStrategy(): IMediaConcatStrategy {
    return {
      async concatenate(inputPaths: string[], outputPath: string): Promise<void> {
        if (inputPaths.length === 0) return;
        if (inputPaths.length === 1) {
          fs.copyFileSync(inputPaths[0], outputPath);
          return;
        }

        const outDir = path.dirname(outputPath);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }

        const tempDir = path.join(os.tmpdir(), 'acc-media', crypto.randomUUID().slice(0, 8));
        fs.mkdirSync(tempDir, { recursive: true });
        const listPath = path.join(tempDir, 'concat_list.txt');

        try {
          // Write concat list formatted with safe paths
          const fileLines = inputPaths.map((p) => `file '${path.resolve(p).replace(/\\/g, '/')}'`);
          fs.writeFileSync(listPath, fileLines.join('\n'), 'utf8');

          const ffmpegPath = FFmpegManager.getFFmpegPath();
          const args = [
            ffmpegPath,
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', listPath,
            '-c', 'copy',
            outputPath,
          ];

          const proc = (Bun as any).spawn(args, { stderr: 'pipe' });
          const exitCode = await proc.exited;

          if (exitCode !== 0) {
            const stderrText = await new Response(proc.stderr).text();
            throw new MediaEngineError(
              MediaEngineType.FluentFFmpeg,
              'FFmpeg lossless concat demuxer failed',
              exitCode,
              stderrText.slice(-1000)
            );
          }
        } finally {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch { }
        }
      },
    };
  }

  public getAudioMuxerStrategy(): IAudioMuxerStrategy {
    return {
      async muxAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
        const ffmpegPath = FFmpegManager.getFFmpegPath();
        const args = [
          ffmpegPath,
          '-y',
          '-i', videoPath,
          '-i', audioPath,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
          outputPath,
        ];

        const proc = (Bun as any).spawn(args, { stderr: 'pipe' });
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          const stderrText = await new Response(proc.stderr).text();
          throw new MediaEngineError(
            MediaEngineType.FluentFFmpeg,
            'Audio/Video muxing failed',
            exitCode,
            stderrText.slice(-1000)
          );
        }
      },
    };
  }

  public getChunkPolicy(): IChunkExecutionPolicy {
    return {
      supportsParallelExecution: true,
      executionMode: 'subprocess',
      getOptimalConcurrency(totalChunks: number, systemCores: number): number {
        // Bounded concurrency to avoid process thrashing
        return Math.min(totalChunks, Math.max(1, Math.floor(systemCores / 2)), 4);
      },
    };
  }

  public async executeCommand(args: string[]): Promise<void> {
    const ffmpegPath = FFmpegManager.getFFmpegPath();
    const fullArgs = [ffmpegPath, ...args];

    const proc = (Bun as any).spawn(fullArgs, { stderr: 'pipe' });
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderrText = await new Response(proc.stderr).text();
      throw new MediaEngineError(
        MediaEngineType.FluentFFmpeg,
        'FFmpeg command execution failed',
        exitCode,
        stderrText.slice(-1000)
      );
    }
  }
}
