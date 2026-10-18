import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  VideoSampleSource,
  VideoSample,
} from 'mediabunny';
import type { IMediaFrameSink, SinkInitMetadata, SinkFinalizeResult, MediaAudioMixResult } from '../types';
import { MediaEngineError } from '../types';


/**
 * Client-side Frame Sink powered by Mediabunny & WebCodecs.
 * Designed for browser environments (apps/studio) with zero server dependencies,
 * muxing directly to an in-memory buffer / Blob.
 */
export class MediabunnyClientSink implements IMediaFrameSink {
  public readonly id = 'mediabunny-client-sink';
  public readonly name = 'Mediabunny Client Video Sink';

  private meta?: SinkInitMetadata;
  private outputPath?: string;
  private framesConsumed: number = 0;
  private output?: Output;
  private videoSource?: VideoSampleSource;
  private bufferTarget?: BufferTarget;

  public async initialize(meta: SinkInitMetadata): Promise<void> {
    this.meta = meta;
    this.outputPath = meta.outputPath;
    this.framesConsumed = 0;

    this.videoSource = new VideoSampleSource({
      codec: 'avc',
      width: meta.width,
      height: meta.height,
      bitrate: 2_000_000,
    });

    this.bufferTarget = new BufferTarget();
    this.output = new Output({
      format: new Mp4OutputFormat(),
      target: this.bufferTarget,
    });

    this.output.addVideoTrack(this.videoSource);
    await this.output.start();
  }

  public async consumeFrame(frameIndex: number, rgbaBuffer: Uint8Array): Promise<void> {
    if (!this.meta || !this.videoSource) {
      throw new MediaEngineError('mediabunny-client', 'MediabunnyClientSink is not initialized.');
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

  public getBuffer(): ArrayBuffer | undefined {
    return this.bufferTarget?.buffer;
  }

  public async finalize(audioResult?: MediaAudioMixResult): Promise<SinkFinalizeResult> {
    if (this.output) {
      await this.output.finalize();
      this.output = undefined;
      this.videoSource = undefined;
    }

    let buffer: ArrayBuffer | undefined;
    if (this.bufferTarget && this.bufferTarget.buffer) {
      buffer = this.bufferTarget.buffer;
    }

    let fileSizeBytes = buffer ? buffer.byteLength : 0;

    // If an outputPath was specified (e.g. running in Node test or electron desktop mode), persist buffer
    if (this.outputPath && buffer && typeof process !== 'undefined' && process.versions?.node) {
      try {
        const nodeFs = await import('fs');
        const nodePath = await import('path');
        const outputDir = nodePath.dirname(this.outputPath);
        if (!nodeFs.existsSync(outputDir)) {
          nodeFs.mkdirSync(outputDir, { recursive: true });
        }
        nodeFs.writeFileSync(this.outputPath, Buffer.from(buffer));
        fileSizeBytes = nodeFs.statSync(this.outputPath).size;
      } catch (err) {
        // Ignore file save failure in non-Node or browser contexts
      }
    }

    return {
      outputPath: this.outputPath,
      durationSeconds: this.meta ? this.meta.durationSeconds : 0,
      framesConsumed: this.framesConsumed,
      fileSizeBytes,
      buffer,
      stats: {
        encoder: 'MediabunnyClientSink',
        resolution: this.meta ? `${this.meta.width}x${this.meta.height}` : 'unknown',
        fps: this.meta?.fps,
        inMemoryBufferSize: buffer ? buffer.byteLength : 0,
      },
    };
  }
}
