import fs from 'fs';
import path from 'path';
import { FFIVideoEncoder } from '../../ffmpeg-ffi/FFIVideoEncoder';
import { FFAudioMuxer } from '../../ffmpeg-ffi/FFAudioMuxer';
import type { IMediaFrameSink, SinkInitMetadata, SinkFinalizeResult, MediaAudioMixResult } from '@acc/core-isomorphic';

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
 * FFIVideoEncoderSink:
 * Direct hardware-accelerated video/audio sink leveraging native bun:ffi FFmpeg.
 * Receives in-memory RGBA frame buffers and encodes them to H.264/AAC MP4 on disk.
 */
export class FFIVideoEncoderSink implements IMediaFrameSink {
  public readonly id = 'ffi-video-encoder-sink';
  public readonly name = 'Hardware-Accelerated Native FFmpeg FFI Encoder Sink';

  private encoder?: FFIVideoEncoder;
  private outputPath: string = '';
  private targetVideoPath: string = '';
  private meta?: SinkInitMetadata;
  private framesConsumed: number = 0;
  private isTwoPass: boolean = false;

  public async initialize(meta: SinkInitMetadata): Promise<void> {
    this.meta = meta;
    this.outputPath = meta.outputPath || path.resolve('./output/ir-render-output.mp4');

    // Ensure output directory exists
    const dir = path.dirname(this.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.isTwoPass = !meta.audioPath;
    this.targetVideoPath = this.isTwoPass
      ? path.resolve(dir, `.temp_video_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp4`)
      : this.outputPath;

    this.framesConsumed = 0;
  }

  public consumeFrame(frameIndex: number, rgbaBuffer: Uint8Array): void {
    if (!this.encoder && this.meta) {
      this.encoder = new FFIVideoEncoder(
        this.meta.width,
        this.meta.height,
        this.meta.fps,
        this.targetVideoPath,
        20,
        this.meta.audioPath
      );
      this.encoder.initialize();
    }

    if (this.encoder) {
      this.encoder.encodeRgbaFrame(rgbaBuffer);
      this.framesConsumed++;
    }
  }

  public async finalize(audioResult?: MediaAudioMixResult): Promise<SinkFinalizeResult> {
    if (this.encoder) {
      this.encoder.close();
      this.encoder = undefined;
    }

    if (this.isTwoPass && fs.existsSync(this.targetVideoPath)) {
      if (audioResult && audioResult.totalSamples > 0) {
        const tempWavPath = path.resolve(
          path.dirname(this.outputPath),
          `.temp_audio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.wav`
        );
        writeFloatWav(tempWavPath, audioResult.buffer, audioResult.sampleRate, audioResult.channels);

        try {
          await FFAudioMuxer.mux(this.targetVideoPath, tempWavPath, this.outputPath);
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
        encoder: 'FFIVideoEncoder',
        resolution: this.meta ? `${this.meta.width}x${this.meta.height}` : 'unknown',
        fps: this.meta?.fps,
      },
    };
  }
}
