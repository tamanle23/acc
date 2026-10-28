import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  StreamTarget,
  VideoSampleSource,
  VideoSample,
  AudioSampleSource,
  AudioSample,
} from 'mediabunny';
import type {
  IMediaFrameSink,
  SinkInitMetadata,
  SinkFinalizeResult,
  MediaAudioMixResult,
} from '@acc/core-isomorphic';

export type { SinkInitMetadata, SinkFinalizeResult };

/**
 * Client-side Frame Sink powered by Mediabunny & WebCodecs.
 * Designed for browser environments (apps/studio) with zero server dependencies,
 * muxing video (AVC/H.264) and audio (AAC) directly to an in-memory buffer / Blob.
 */
export class MediabunnyClientSink implements IMediaFrameSink {
  public readonly id = 'mediabunny-client-sink';
  public readonly name = 'Mediabunny Client Video Sink';

  private meta?: SinkInitMetadata;
  private outputPath?: string;
  private framesConsumed: number = 0;
  private output?: Output;
  private videoSource?: VideoSampleSource;
  private audioSource?: AudioSampleSource;
  private bufferTarget?: BufferTarget;
  private streamTarget?: StreamTarget;
  private hasAudioTrack: boolean = false;

  public async initialize(
    meta: SinkInitMetadata & { enableAudio?: boolean; writableStream?: WritableStream<Uint8Array> }
  ): Promise<void> {
    this.meta = meta;
    this.outputPath = meta.outputPath;
    this.framesConsumed = 0;

    this.videoSource = new VideoSampleSource({
      codec: 'avc',
      width: meta.width,
      height: meta.height,
      bitrate: 2_000_000,
    });

    if (meta.writableStream) {
      this.streamTarget = new StreamTarget(meta.writableStream);
      this.output = new Output({
        format: new Mp4OutputFormat(),
        target: this.streamTarget,
      });
    } else {
      this.bufferTarget = new BufferTarget();
      this.output = new Output({
        format: new Mp4OutputFormat(),
        target: this.bufferTarget,
      });
    }

    this.output.addVideoTrack(this.videoSource);

    // If audio is enabled or requested, configure AAC stereo audio track
    if (meta.enableAudio !== false) {
      this.audioSource = new AudioSampleSource({
        codec: 'aac',
        sampleRate: 48_000,
        numberOfChannels: 2,
        bitrate: 192_000,
      });
      this.output.addAudioTrack(this.audioSource);
      this.hasAudioTrack = true;
    } else {
      this.hasAudioTrack = false;
    }

    await this.output.start();
  }

  public async consumeFrame(frameIndex: number, rgbaBuffer: Uint8Array): Promise<void> {
    if (!this.meta || !this.videoSource) {
      throw new Error('[MediabunnyClientSink] Sink is not initialized.');
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
    // If audio track is enabled and audioResult is provided, encode PCM audio samples
    if (this.audioSource && audioResult && audioResult.totalSamples > 0) {
      const sampleRate = audioResult.sampleRate || 48_000;
      const channels = audioResult.channels || 2;
      const totalFrames = audioResult.totalSamples;

      // Prepare planar Float32 chunks (f32-planar format)
      // Chunk size capped at 2048 frames per audio sample
      const chunkSize = 2048;
      let frameOffset = 0;

      while (frameOffset < totalFrames) {
        const framesInChunk = Math.min(chunkSize, totalFrames - frameOffset);
        const chunkData = new Float32Array(channels * framesInChunk);

        if (audioResult.pcmLeft && audioResult.pcmRight) {
          // De-interleaved planar source
          chunkData.set(audioResult.pcmLeft.subarray(frameOffset, frameOffset + framesInChunk), 0);
          chunkData.set(audioResult.pcmRight.subarray(frameOffset, frameOffset + framesInChunk), framesInChunk);
        } else if (audioResult.buffer) {
          // Interleaved source -> convert to f32-planar (L...R...)
          for (let f = 0; f < framesInChunk; f++) {
            const srcIdx = (frameOffset + f) * channels;
            chunkData[f] = audioResult.buffer[srcIdx]; // L
            chunkData[framesInChunk + f] = channels > 1 ? audioResult.buffer[srcIdx + 1] : audioResult.buffer[srcIdx]; // R
          }
        }

        const audioSample = new AudioSample({
          format: 'f32-planar',
          sampleRate,
          numberOfFrames: framesInChunk,
          numberOfChannels: channels,
          timestamp: frameOffset / sampleRate,
          data: chunkData,
        });

        await this.audioSource.add(audioSample);
        audioSample.close();

        frameOffset += framesInChunk;
      }
    }

    if (this.output) {
      await this.output.finalize();
      this.output = undefined;
      this.videoSource = undefined;
      this.audioSource = undefined;
    }

    let buffer: ArrayBuffer | undefined;
    if (this.bufferTarget && this.bufferTarget.buffer) {
      buffer = this.bufferTarget.buffer;
    }

    let fileSizeBytes = buffer ? buffer.byteLength : 0;

    // If an outputPath was specified (e.g. running in Node test or desktop mode), persist buffer
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
      } catch {
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

  public async dispose(): Promise<void> {
    if (this.output) {
      try {
        await this.output.finalize();
      } catch {}
      this.output = undefined;
    }
    this.videoSource = undefined;
    this.audioSource = undefined;
    this.bufferTarget = undefined;
    this.streamTarget = undefined;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }
}
