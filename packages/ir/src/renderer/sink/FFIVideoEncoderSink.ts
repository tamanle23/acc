import fs from 'fs';
import path from 'path';
import { FFIVideoEncoder } from '@acc/core';
import type { IIRFrameSink, SinkInitMetadata, SinkFinalizeResult } from './IIRFrameSink';
import type { DecoupledAudioMixResult } from '../audio/DecoupledAudioMixer';

/**
 * FFIVideoEncoderSink:
 * Direct hardware-accelerated video/audio sink leveraging native bun:ffi FFmpeg.
 * Receives in-memory RGBA frame buffers and encodes them to H.264/AAC MP4 on disk
 * with zero intermediate disk caching.
 */
export class FFIVideoEncoderSink implements IIRFrameSink {
  public readonly id = 'ffi-video-encoder-sink';
  public readonly name = 'Hardware-Accelerated Native FFmpeg FFI Encoder Sink';

  private encoder?: FFIVideoEncoder;
  private outputPath: string = '';
  private tempAudioPath?: string;
  private meta?: SinkInitMetadata;
  private framesConsumed: number = 0;

  public async initialize(meta: SinkInitMetadata): Promise<void> {
    this.meta = meta;
    this.outputPath = meta.outputPath || path.resolve('./output/ir-render-output.mp4');

    // Ensure output directory exists
    const dir = path.dirname(this.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.framesConsumed = 0;
  }

  public consumeFrame(frameIndex: number, rgbaBuffer: Uint8Array): void {
    if (!this.encoder && this.meta) {
      // Lazy initialization of encoder
      this.encoder = new FFIVideoEncoder(
        this.meta.width,
        this.meta.height,
        this.meta.fps,
        this.outputPath,
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

  public async finalize(audioResult?: DecoupledAudioMixResult): Promise<SinkFinalizeResult> {
    if (this.encoder) {
      // If mixed audio stream was provided and no external audioPath was configured,
      // write raw PCM to a temporary audio file and encode it
      if (audioResult && !this.meta?.audioPath && audioResult.totalSamples > 0) {
        this.tempAudioPath = path.resolve(path.dirname(this.outputPath), `.temp_${Date.now()}_audio.pcm`);
        // Write raw interleaved float32 buffer
        fs.writeFileSync(this.tempAudioPath, Buffer.from(audioResult.buffer.buffer));
      }

      this.encoder.close();
      this.encoder = undefined;
    }

    // Clean up temporary audio file if created
    if (this.tempAudioPath && fs.existsSync(this.tempAudioPath)) {
      try {
        fs.unlinkSync(this.tempAudioPath);
      } catch {
        // Ignored
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
