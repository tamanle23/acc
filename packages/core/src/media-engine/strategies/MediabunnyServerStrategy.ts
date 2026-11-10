import fs from 'fs';
import os from 'os';
import { registerMediabunnyServer } from '@mediabunny/server';
import {
  Input,
  Output,
  Mp4OutputFormat,
  FilePathSource,
  FilePathTarget,
  ALL_FORMATS,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacket,
  AudioSampleSink,
  CanvasSink,
} from 'mediabunny';
import { FFAudioMuxer } from '../../ffmpeg-ffi/FFAudioMuxer';
import {
  IMediaEngineStrategy,
  MediaEngineType,
  MediaEngineCapabilities,
  IMediaFrameSink,
  IAudioDecoder,
  IVideoDecoder,
  ICanvasInstance,
  ICanvasContext2D,
  UniversalCanvasProvider,
  DecodedAudioPCM,
  IMediaProbeStrategy,
  IMediaConcatStrategy,
  IAudioMuxerStrategy,
  IChunkExecutionPolicy,
  MediaProbeResult,
  SinkInitMetadata,
} from '@acc/core-isomorphic';
import { MediaEngineError } from '@acc/core-isomorphic';
import { MediabunnyServerSink } from '../sinks/MediabunnyServerSink';

export class MediabunnyProbeStrategy implements IMediaProbeStrategy {
  public async probe(filePath: string): Promise<MediaProbeResult> {
    if (!fs.existsSync(filePath)) {
      throw new MediaEngineError(MediaEngineType.MediabunnyServer, `File not found for probing: ${filePath}`);
    }

    try {
      const input = new Input({
        formats: ALL_FORMATS,
        source: new FilePathSource(filePath),
      });

      const durationSeconds = await input.computeDuration();
      const videoTrack = await input.getPrimaryVideoTrack();
      const audioTrack = await input.getPrimaryAudioTrack();

      let fps: number | undefined;
      if (videoTrack) {
        try {
          const metrics = await videoTrack.computeFrameRateMetrics();
          if (metrics && metrics.averageFps) {
            fps = Math.round(metrics.averageFps);
          }
        } catch { }
      }

      return {
        durationSeconds: durationSeconds || 0,
        width: videoTrack ? videoTrack.displayWidth : undefined,
        height: videoTrack ? videoTrack.displayHeight : undefined,
        fps,
        codecVideo: videoTrack ? videoTrack.codec : undefined,
        codecAudio: audioTrack ? audioTrack.codec : undefined,
        hasVideo: videoTrack !== null,
        hasAudio: audioTrack !== null,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MediaEngineError(MediaEngineType.MediabunnyServer, `Mediabunny probe failed on ${filePath}: ${msg}`);
    }
  }
}

export class MediabunnyConcatStrategy implements IMediaConcatStrategy {
  public async concatenate(inputPaths: string[], outputPath: string): Promise<void> {
    if (inputPaths.length === 0) {
      throw new MediaEngineError(MediaEngineType.MediabunnyServer, 'No input files provided for concatenation.');
    }
    if (inputPaths.length === 1) {
      fs.copyFileSync(inputPaths[0], outputPath);
      return;
    }

    try {
      // Probe initial tracks
      const firstInput = new Input({ formats: ALL_FORMATS, source: new FilePathSource(inputPaths[0]) });
      const firstVideoTrack = await firstInput.getPrimaryVideoTrack();
      const firstAudioTrack = await firstInput.getPrimaryAudioTrack();

      if (!firstVideoTrack && !firstAudioTrack) {
        throw new MediaEngineError(MediaEngineType.MediabunnyServer, 'Input file contains neither video nor audio tracks.');
      }

      let videoSource: EncodedVideoPacketSource | undefined;
      let videoDecoderConfig: unknown;
      if (firstVideoTrack) {
        videoDecoderConfig = await firstVideoTrack.getDecoderConfig();
        videoSource = new EncodedVideoPacketSource(firstVideoTrack.codec);
      }

      let audioSource: EncodedAudioPacketSource | undefined;
      let audioDecoderConfig: unknown;
      if (firstAudioTrack) {
        audioDecoderConfig = await firstAudioTrack.getDecoderConfig();
        audioSource = new EncodedAudioPacketSource(firstAudioTrack.codec);
      }

      const output = new Output({
        format: new Mp4OutputFormat(),
        target: new FilePathTarget(outputPath),
      });

      if (videoSource && firstVideoTrack) {
        output.addVideoTrack(videoSource, {
          width: firstVideoTrack.displayWidth,
          height: firstVideoTrack.displayHeight,
        });
      }

      if (audioSource) {
        output.addAudioTrack(audioSource);
      }

      await output.start();

      let videoTimeOffset = 0;
      let audioTimeOffset = 0;

      for (const inputPath of inputPaths) {
        const input = new Input({ formats: ALL_FORMATS, source: new FilePathSource(inputPath) });

        if (videoSource) {
          const vTrack = await input.getPrimaryVideoTrack();
          if (vTrack) {
            const trackDur = await vTrack.computeDuration();
            const vSink = new EncodedPacketSink(vTrack);
            let first = true;
            for await (const pkt of vSink.packets()) {
              const meta = (first || pkt.isKey) ? { decoderConfig: videoDecoderConfig } : undefined;
              const newPkt = new EncodedPacket(
                pkt.data,
                pkt.type,
                pkt.timestamp + videoTimeOffset,
                pkt.duration
              );
              videoSource.add(newPkt, meta as any);
              first = false;
            }
            videoTimeOffset += (trackDur || 0);
          }
        }

        if (audioSource) {
          const aTrack = await input.getPrimaryAudioTrack();
          if (aTrack) {
            const trackDur = await aTrack.computeDuration();
            const aSink = new EncodedPacketSink(aTrack);
            let first = true;
            for await (const pkt of aSink.packets()) {
              const meta = first ? { decoderConfig: audioDecoderConfig } : undefined;
              const newPkt = new EncodedPacket(
                pkt.data,
                pkt.type,
                pkt.timestamp + audioTimeOffset,
                pkt.duration
              );
              audioSource.add(newPkt, meta as any);
              first = false;
            }
            audioTimeOffset += (trackDur || 0);
          }
        }
      }

      await output.finalize();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MediaEngineError(MediaEngineType.MediabunnyServer, `Mediabunny lossless concatenation failed: ${msg}`);
    }
  }
}

export class MediabunnyAudioMuxerStrategy implements IAudioMuxerStrategy {
  public async muxAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    try {
      await FFAudioMuxer.mux(videoPath, audioPath, outputPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MediaEngineError(MediaEngineType.MediabunnyServer, `Mediabunny audio multiplexing failed: ${msg}`);
    }
  }
}

export class MediabunnyServerChunkPolicy implements IChunkExecutionPolicy {
  public readonly supportsParallelExecution = true;
  public readonly executionMode = 'worker-thread';

  public getOptimalConcurrency(totalChunks: number, systemCores: number): number {
    const memFree = os.freemem() / (1024 * 1024 * 1024);
    const memLimit = Math.max(1, Math.floor(memFree / 1.5));
    const cpuLimit = Math.max(1, Math.min(systemCores, 4));
    return Math.min(totalChunks, cpuLimit, memLimit);
  }
}

/**
 * MediabunnyVideoDecoder:
 * Decodes video files frame-by-frame or via random-access seeking leveraging mediabunny.CanvasSink.
 * Provides 100% strategy parity with FFIVideoDecoder for server/node runtimes.
 */
export class MediabunnyVideoDecoder implements IVideoDecoder {
  private input: Input | null = null;
  private canvasSink: CanvasSink | null = null;
  private canvas: ICanvasInstance | null = null;
  private ctx: ICanvasContext2D | null = null;
  private isOpened = false;
  private currentTimestampSec = 0;
  private fps = 30;
  public readonly width: number;
  public readonly height: number;
  public duration: number = 0;

  constructor(private videoPath: string, targetWidth: number, targetHeight: number) {
    this.width = targetWidth;
    this.height = targetHeight;
  }

  public async open(): Promise<boolean> {
    if (this.isOpened) return true;
    if (!fs.existsSync(this.videoPath)) {
      return false;
    }

    try {
      this.input = new Input({
        formats: ALL_FORMATS,
        source: new FilePathSource(this.videoPath),
      });

      this.duration = await this.input.computeDuration();
      const videoTrack = await this.input.getPrimaryVideoTrack();
      if (!videoTrack) {
        return false;
      }

      this.canvasSink = new CanvasSink(videoTrack, { poolSize: 2 });
      this.canvas = UniversalCanvasProvider.createCanvas(this.width, this.height);
      this.ctx = this.canvas.getContext('2d');
      this.isOpened = true;
      this.currentTimestampSec = 0;
      return true;
    } catch {
      return false;
    }
  }

  public async seekTimestamp(targetSeconds: number): Promise<ICanvasInstance | null> {
    if (!this.isOpened || !this.canvasSink || !this.canvas || !this.ctx) return null;
    this.currentTimestampSec = Math.max(0, targetSeconds);
    return this.renderFrameAtSec(this.currentTimestampSec);
  }

  public async readNextFrame(): Promise<ICanvasInstance | null> {
    if (!this.isOpened || !this.canvasSink || !this.canvas || !this.ctx) return null;
    const frame = await this.renderFrameAtSec(this.currentTimestampSec);
    this.currentTimestampSec += 1 / this.fps;
    return frame;
  }

  private async renderFrameAtSec(sec: number): Promise<ICanvasInstance | null> {
    if (!this.canvasSink || !this.ctx || !this.canvas) return null;
    try {
      const wrappedCanvas = await this.canvasSink.getCanvas(sec);
      if (!wrappedCanvas) return null;
      const raw = typeof wrappedCanvas.getRawCanvas === 'function'
        ? wrappedCanvas.getRawCanvas()
        : wrappedCanvas.canvas || wrappedCanvas;

      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.drawImage(raw, 0, 0, this.width, this.height);
      return this.canvas;
    } catch {
      return null;
    }
  }

  public close(): void {
    if (!this.isOpened) return;
    try {
      if (this.canvasSink && typeof (this.canvasSink as any).close === 'function') {
        (this.canvasSink as any).close();
      }
    } catch { }
    this.canvasSink = null;
    this.input = null;
    this.isOpened = false;
  }
}

/**
 * Mediabunny Server Media Engine Strategy.
 * Utilizes pure TypeScript demuxing/muxing combined with NodeAV server-side codecs.
 */
export class MediabunnyServerStrategy implements IMediaEngineStrategy {
  public readonly id = MediaEngineType.MediabunnyServer;
  public readonly name: string = 'Mediabunny Server Engine (NodeAV & TypeScript Muxer)';

  public readonly capabilities: MediaEngineCapabilities = {
    supportsZeroCopyFFI: false,
    supportsComplexFilters: false,
    supportsRawFrameStream: true,
    supportsBrowserRuntime: false,
    requiresNativeBinaries: false,
  };

  private probeStrategy = new MediabunnyProbeStrategy();
  private concatStrategy = new MediabunnyConcatStrategy();
  private audioMuxerStrategy = new MediabunnyAudioMuxerStrategy();
  private chunkPolicy = new MediabunnyServerChunkPolicy();

  public validatePrerequisites(): void {
    try {
      registerMediabunnyServer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MediaEngineError(this.id, `Failed to initialize server codecs: ${msg}`);
    }
  }

  public createVideoDecoder(filePath: string, targetWidth: number, targetHeight: number): IVideoDecoder {
    this.validatePrerequisites();
    return new MediabunnyVideoDecoder(filePath, targetWidth, targetHeight);
  }

  public createVideoSink(options?: SinkInitMetadata): IMediaFrameSink {
    return new MediabunnyServerSink();
  }

  public createAudioDecoder(): IAudioDecoder {
    return {
      decodeToPCM: async (filePath: string, targetSampleRate = 48000, targetChannels = 2): Promise<DecodedAudioPCM | null> => {
        if (!fs.existsSync(filePath)) {
          return null;
        }

        try {
          // If FFIAudioDecoder is available in current runtime (Bun/FFI), take fast native path
          try {
            const ffiModule = await import('../../ffmpeg-ffi/FFIAudioDecoder');
            if (ffiModule?.FFIAudioDecoder) {
              const decoded = await ffiModule.FFIAudioDecoder.decodeToPCM(filePath, targetSampleRate, targetChannels);
              if (decoded) return decoded;
            }
          } catch {
            // Fall back to Mediabunny Server decoding pipeline
          }

          this.validatePrerequisites();

          const input = new Input({
            formats: ALL_FORMATS,
            source: new FilePathSource(filePath),
          });

          const audioTrack = await input.getPrimaryAudioTrack();
          if (!audioTrack) {
            return null;
          }

          let detectedSampleRate: number | undefined;
          try {
            if (typeof (audioTrack as any).getSampleRate === 'function') {
              detectedSampleRate = await (audioTrack as any).getSampleRate();
            }
          } catch {}

          const durationSeconds = await input.computeDuration();
          const audioSink = new AudioSampleSink(audioTrack);
          const sampleChunks: Float32Array[] = [];
          let totalExtractedSamplesPerChannel = 0;

          for await (const sample of audioSink.samples()) {
            try {
              const numFrames = sample.numberOfFrames;
              const numChannels = sample.numberOfChannels;
              if (!detectedSampleRate && sample.sampleRate) {
                detectedSampleRate = sample.sampleRate;
              }

              const interleaved = new Float32Array(numFrames * 2);

              if (numChannels === 1) {
                // Mono source: duplicate mono samples into both Left and Right stereo channels
                const mono = new Float32Array(numFrames);
                sample.copyTo(mono, { planeIndex: 0, format: 'f32-planar' });
                for (let i = 0; i < numFrames; i++) {
                  interleaved[i * 2] = mono[i];
                  interleaved[i * 2 + 1] = mono[i];
                }
              } else if (sample.format === 'f32') {
                // Interleaved stereo f32 source
                const rawInterleaved = new Float32Array(numFrames * numChannels);
                sample.copyTo(rawInterleaved, { planeIndex: 0, format: 'f32' });
                for (let i = 0; i < numFrames; i++) {
                  interleaved[i * 2] = rawInterleaved[i * numChannels];
                  interleaved[i * 2 + 1] = rawInterleaved[i * numChannels + 1];
                }
              } else {
                // Planar or multi-channel source: extract plane 0 (L) and plane 1 (R)
                const left = new Float32Array(numFrames);
                const right = new Float32Array(numFrames);
                sample.copyTo(left, { planeIndex: 0, format: 'f32-planar' });
                if (numChannels > 1) {
                  sample.copyTo(right, { planeIndex: 1, format: 'f32-planar' });
                } else {
                  right.set(left);
                }
                for (let i = 0; i < numFrames; i++) {
                  interleaved[i * 2] = left[i];
                  interleaved[i * 2 + 1] = right[i];
                }
              }

              sampleChunks.push(interleaved);
              totalExtractedSamplesPerChannel += numFrames;
            } finally {
              sample.close();
            }
          }

          if (sampleChunks.length === 0) {
            return null;
          }

          const finalPcm = new Float32Array(totalExtractedSamplesPerChannel * 2);
          let offset = 0;
          for (const chunk of sampleChunks) {
            finalPcm.set(chunk, offset);
            offset += chunk.length;
          }

          const actualRate = detectedSampleRate || targetSampleRate;
          return {
            sampleRate: actualRate,
            channels: 2,
            totalSamplesPerChannel: totalExtractedSamplesPerChannel,
            durationSeconds: durationSeconds || (totalExtractedSamplesPerChannel / actualRate),
            data: finalPcm,
          };
        } catch (err) {
          return null;
        }
      },
    };
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
