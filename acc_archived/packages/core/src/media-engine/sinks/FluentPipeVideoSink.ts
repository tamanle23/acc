import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { FFmpegManager } from '../../FFmpegManager';
import { GPUEncoderResolver } from '../../ffmpeg-ffi/GPUEncoderResolver';
import type { IMediaFrameSink, SinkInitMetadata, SinkFinalizeResult, MediaAudioMixResult } from '../types';
import { MediaEngineError } from '../types';

function writeFloatWav(filePath: string, floatData: Float32Array, sampleRate: number, channels: number): void {
  const byteLength = floatData.byteLength;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + byteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM/Float)
  header.writeUInt16LE(3, 20); // AudioFormat (3 = IEEE Float)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 4, 28); // ByteRate
  header.writeUInt16LE(channels * 4, 32); // BlockAlign
  header.writeUInt16LE(32, 34); // BitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(byteLength, 40);

  const fd = fs.openSync(filePath, 'w');
  fs.writeSync(fd, header);
  fs.writeSync(fd, Buffer.from(floatData.buffer, floatData.byteOffset, floatData.byteLength));
  fs.closeSync(fd);
}

/**
 * FluentPipeVideoSink:
 * CLI-isolated video/audio sink using native Bun.spawn and stdin pipe streaming.
 * Provides process crash isolation and full FFmpeg CLI compatibility.
 */
export class FluentPipeVideoSink implements IMediaFrameSink {
  public readonly id = 'fluent-pipe-video-sink';
  public readonly name = 'CLI-Isolated FFmpeg Pipe Video Sink';

  private meta?: SinkInitMetadata;
  private outputPath: string = '';
  private scratchDir: string = '';
  private tempVideoPath: string = '';
  private framesConsumed: number = 0;
  private proc?: any;
  private stderrTail: string[] = [];
  private isFinalized: boolean = false;

  public async initialize(meta: SinkInitMetadata): Promise<void> {
    this.meta = meta;
    this.outputPath = meta.outputPath || path.resolve('./output/fluent-render-output.mp4');

    const outDir = path.dirname(this.outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const uniqueId = crypto.randomUUID().slice(0, 8);
    this.scratchDir = meta.tempDir || path.join(os.tmpdir(), 'acc-media', uniqueId);
    if (!fs.existsSync(this.scratchDir)) {
      fs.mkdirSync(this.scratchDir, { recursive: true });
    }

    this.tempVideoPath = path.join(this.scratchDir, `temp_video_${uniqueId}.mp4`);
    this.framesConsumed = 0;
    this.stderrTail = [];
    this.isFinalized = false;
  }

  private startSubprocess(): void {
    if (!this.meta) throw new Error('Sink not initialized');

    const ffmpegPath = FFmpegManager.getFFmpegPath();
    let encoderCodec = 'libx264';
    try {
      const gpuResolution = GPUEncoderResolver.resolveSync();
      if (gpuResolution && gpuResolution.encoderName) {
        encoderCodec = gpuResolution.encoderName;
      }
    } catch {
      encoderCodec = 'libx264';
    }

    const codecArgs = encoderCodec === 'libx264'
      ? ['-preset', 'veryfast', '-crf', '20']
      : (encoderCodec.includes('videotoolbox')
          ? ['-b:v', '5M', '-allow_sw', '1']
          : ['-b:v', '5M']);

    const args = [
      ffmpegPath,
      '-y',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', `${this.meta.width}x${this.meta.height}`,
      '-r', `${this.meta.fps}`,
      '-i', 'pipe:0',
      '-c:v', encoderCodec,
      ...codecArgs,
      '-pix_fmt', 'yuv420p',
      this.tempVideoPath,
    ];

    try {
      this.proc = (Bun as any).spawn(args, {
        stdin: 'pipe',
        stderr: 'pipe',
      });
    } catch (err: any) {
      throw new MediaEngineError('fluent-ffmpeg', `Failed to spawn FFmpeg process: ${err.message}`);
    }

    // Accumulate stderr tail for diagnostics
    (async () => {
      try {
        const reader = this.proc.stderr.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split(/\r?\n/).filter(Boolean);
          for (const line of lines) {
            this.stderrTail.push(line);
            if (this.stderrTail.length > 25) {
              this.stderrTail.shift();
            }
          }
        }
      } catch {
        // Stderr closed
      }
    })();
  }

  public async consumeFrame(frameIndex: number, rgbaBuffer: Uint8Array): Promise<void> {
    if (!this.proc) {
      this.startSubprocess();
    }

    try {
      this.proc.stdin.write(rgbaBuffer);
      if (typeof this.proc.stdin.flush === 'function') {
        this.proc.stdin.flush();
      }
      this.framesConsumed++;
    } catch (err: any) {
      const exitCode = await Promise.race([
        this.proc.exited,
        new Promise<number>((r) => setTimeout(() => r(-1), 100)),
      ]);
      throw new MediaEngineError(
        'fluent-ffmpeg',
        `Broken pipe while feeding frame ${frameIndex}: ${err.message}`,
        exitCode,
        this.stderrTail.slice(-15).join('\n')
      );
    }
  }

  public async finalize(audioResult?: MediaAudioMixResult): Promise<SinkFinalizeResult> {
    if (this.isFinalized) {
      throw new Error('FluentPipeVideoSink has already been finalized.');
    }
    this.isFinalized = true;

    if (this.proc) {
      try {
        this.proc.stdin.end();
      } catch {}

      const exitCode = await this.proc.exited;
      if (exitCode !== 0) {
        this.cleanupScratch();
        throw new MediaEngineError(
          'fluent-ffmpeg',
          'FFmpeg video frame encoding process exited with error.',
          exitCode,
          this.stderrTail.slice(-20).join('\n')
        );
      }
    }

    const ffmpegPath = FFmpegManager.getFFmpegPath();

    // Two-Pass Stream Copy Mux for Audio
    if (audioResult && audioResult.totalSamples > 0 && fs.existsSync(this.tempVideoPath)) {
      const tempWavPath = path.join(this.scratchDir, 'temp_audio.wav');
      writeFloatWav(tempWavPath, audioResult.buffer, audioResult.sampleRate, audioResult.channels);

      const muxArgs = [
        ffmpegPath,
        '-y',
        '-i', this.tempVideoPath,
        '-i', tempWavPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        this.outputPath,
      ];

      const muxProc = (Bun as any).spawn(muxArgs, { stderr: 'pipe' });
      const muxCode = await muxProc.exited;
      if (muxCode !== 0) {
        const errText = await new Response(muxProc.stderr).text();
        this.cleanupScratch();
        throw new MediaEngineError(
          'fluent-ffmpeg',
          'Audio/Video muxing stream copy failed.',
          muxCode,
          errText.slice(-1000)
        );
      }
    } else if (fs.existsSync(this.tempVideoPath)) {
      // Direct move/copy to outputPath
      if (fs.existsSync(this.outputPath)) {
        try { fs.unlinkSync(this.outputPath); } catch {}
      }
      fs.copyFileSync(this.tempVideoPath, this.outputPath);
    }

    this.cleanupScratch();

    let fileSizeBytes = 0;
    if (fs.existsSync(this.outputPath)) {
      fileSizeBytes = fs.statSync(this.outputPath).size;
    }

    return {
      outputPath: this.outputPath,
      durationSeconds: this.meta ? this.meta.durationSeconds : 0,
      framesConsumed: this.framesConsumed,
      fileSizeBytes,
      stats: {
        encoder: 'FluentPipeVideoSink (Bun.spawn)',
        resolution: this.meta ? `${this.meta.width}x${this.meta.height}` : 'unknown',
        fps: this.meta?.fps,
      },
    };
  }

  private cleanupScratch(): void {
    if (this.scratchDir && fs.existsSync(this.scratchDir)) {
      try {
        fs.rmSync(this.scratchDir, { recursive: true, force: true });
      } catch {
        // Ignored
      }
    }
  }
}
