import fs from 'fs';
import path from 'path';
import { registerMediabunnyServer } from '@mediabunny/server';
import {
  Output,
  Mp4OutputFormat,
  FilePathTarget,
  VideoSampleSource,
  VideoSample,
} from 'mediabunny';
import { FFAudioMuxer } from '../../ffmpeg-ffi/FFAudioMuxer';
import type { IMediaFrameSink, SinkInitMetadata, SinkFinalizeResult, MediaAudioMixResult } from '@acc/core-isomorphic';
import { MediaEngineError } from '@acc/core-isomorphic';

function writeFloatWav(filePath: string, floatData: Float32Array, sampleRate: number, channels: number): void {
  const byteLength = floatData.byteLength;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + byteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE Float
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 4, 28);
  header.writeUInt16LE(channels * 4, 32);
  header.writeUInt16LE(32, 34);
  header.write('data', 36);
  header.writeUInt32LE(byteLength, 40);

  const fd = fs.openSync(filePath, 'w');
  fs.writeSync(fd, header);
  fs.writeSync(fd, Buffer.from(floatData.buffer, floatData.byteOffset, floatData.byteLength));
  fs.closeSync(fd);
}

/**
 * Server-side Frame Sink powered by Mediabunny & NodeAV.
 * Encodes RGBA frame buffers into MP4 using pure TypeScript & NodeAV codecs.
 */
export class MediabunnyServerSink implements IMediaFrameSink {
  public readonly id = 'mediabunny-server-sink';
  public readonly name = 'Mediabunny Server Video Sink';

  private meta?: SinkInitMetadata;
  private outputPath: string = '';
  private targetVideoPath: string = '';
  private isTwoPass: boolean = false;
  private framesConsumed: number = 0;
  private output?: Output;
  private videoSource?: VideoSampleSource;

  public async initialize(meta: SinkInitMetadata): Promise<void> {
    this.meta = meta;
    this.outputPath = path.resolve(meta.outputPath || path.join(process.cwd(), 'output_mediabunny.mp4'));
    this.framesConsumed = 0;

    // Ensure server codecs are hooked up via NodeAV
    registerMediabunnyServer();

    const outputDir = path.dirname(this.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Two-pass approach to guarantee clean audio muxing
    this.isTwoPass = true;
    const dir = meta.tempDir || outputDir;
    this.targetVideoPath = path.resolve(
      dir,
      `.temp_mb_video_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp4`
    );

    this.videoSource = new VideoSampleSource({
      codec: 'avc',
      width: meta.width,
      height: meta.height,
      bitrate: 2_000_000,
    });

    this.output = new Output({
      format: new Mp4OutputFormat(),
      target: new FilePathTarget(this.targetVideoPath),
    });

    this.output.addVideoTrack(this.videoSource);
    await this.output.start();
  }

  public async consumeFrame(frameIndex: number, rgbaBuffer: Uint8Array): Promise<void> {
    if (!this.meta || !this.videoSource) {
      throw new MediaEngineError('mediabunny-server', 'MediabunnyServerSink is not initialized.');
    }

    const timestamp = frameIndex / this.meta.fps;
    const duration = 1 / this.meta.fps;

    const sample = new VideoSample(rgbaBuffer, {
      format: 'RGBA',
      codedWidth: this.meta.width,
      codedHeight: this.meta.height,
      timestamp,
      duration,
    });

    await this.videoSource.add(sample);
    sample.close();
    this.framesConsumed++;
  }

  public async finalize(audioResult?: MediaAudioMixResult): Promise<SinkFinalizeResult> {
    if (this.output) {
      await this.output.finalize();
      this.output = undefined;
      this.videoSource = undefined;
    }

    if (this.isTwoPass && fs.existsSync(this.targetVideoPath)) {
      if (audioResult && audioResult.totalSamples > 0) {
        const tempWavPath = path.resolve(
          path.dirname(this.outputPath),
          `.temp_mb_audio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.wav`
        );
        writeFloatWav(tempWavPath, audioResult.buffer, audioResult.sampleRate, audioResult.channels);

        try {
          await FFAudioMuxer.mux(this.targetVideoPath, tempWavPath, this.outputPath);
        } catch (err: unknown) {
          // Fallback: if audio mux fails, move video to output path
          if (fs.existsSync(this.outputPath)) {
            try { fs.unlinkSync(this.outputPath); } catch {}
          }
          fs.renameSync(this.targetVideoPath, this.outputPath);
        } finally {
          try { if (fs.existsSync(this.targetVideoPath)) fs.unlinkSync(this.targetVideoPath); } catch {}
          try { if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath); } catch {}
        }
      } else {
        if (fs.existsSync(this.outputPath)) {
          try { fs.unlinkSync(this.outputPath); } catch {}
        }
        fs.renameSync(this.targetVideoPath, this.outputPath);
      }
    }

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
        encoder: 'MediabunnyServerSink',
        resolution: this.meta ? `${this.meta.width}x${this.meta.height}` : 'unknown',
        fps: this.meta?.fps,
      },
    };
  }
}
