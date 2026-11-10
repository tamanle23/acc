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
  BlobSource,
  BufferSource,
  UrlSource,
} from 'mediabunny';
import { FFAudioMuxer } from '../../ffmpeg-ffi/FFAudioMuxer';
import {
  IMediaEngineStrategy,
  MediaEngineType,
  MediaEngineCapabilities,
  IMediaFrameSink,
  IAudioDecoder,
  IVideoDecoder,
  VideoDecoderOptions,
  ICanvasInstance,
  ICanvasContext2D,
  UniversalCanvasProvider,
  AssetProtocolRegistry,
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
 * Resolves media URI or path to a valid Mediabunny Source instance for server/node runtime.
 * Supports native file paths, cache:// (OPFS/memory), blob:, http(s)://, and data: URIs.
 */
export async function resolveServerMediabunnySource(uriOrPath: string): Promise<any> {
  const registry = AssetProtocolRegistry.getInstance();
  const asset = registry.resolve(uriOrPath);

  // 1. Native filesystem check
  const nativePath = typeof asset.getNativePath === 'function' ? asset.getNativePath() : null;
  if (nativePath && fs.existsSync(nativePath)) {
    return new FilePathSource(nativePath);
  }

  // 2. Direct filesystem path fallback
  if (fs.existsSync(uriOrPath)) {
    return new FilePathSource(uriOrPath);
  }

  // 3. Remote URL
  if (uriOrPath.startsWith('http://') || uriOrPath.startsWith('https://')) {
    return new UrlSource(uriOrPath);
  }

  // 4. Blob or Cached Asset (OPFS / Memory)
  if (typeof asset.blob === 'function') {
    const blob = await asset.blob();
    if (blob) {
      return new BlobSource(blob);
    }
  }

  // 5. ArrayBuffer fallback
  if (typeof asset.arrayBuffer === 'function') {
    const ab = await asset.arrayBuffer();
    if (ab) {
      return new BufferSource(ab);
    }
  }

  throw new Error(`[resolveServerMediabunnySource] Unable to resolve source for asset: ${uriOrPath}`);
}

/**
 * MediabunnyVideoDecoder:
 * Decodes video files frame-by-frame or via random-access seeking leveraging mediabunny.CanvasSink.
 * Provides 100% strategy parity with FFIVideoDecoder for server/node runtimes.
 */
export class MediabunnyVideoDecoder implements IVideoDecoder {
  private input: Input | null = null;
  private canvasSink: CanvasSink | null = null;
  private isOpened = false;
  private currentTimestampSec = 0;
  private fps = 30;
  public width: number;
  public height: number;
  public duration: number = 0;
  private options?: VideoDecoderOptions;

  constructor(
    private videoPath: string,
    targetWidth: number,
    targetHeight: number,
    options?: VideoDecoderOptions
  ) {
    this.width = targetWidth;
    this.height = targetHeight;
    this.options = options;
  }

  public async open(): Promise<boolean> {
    if (this.isOpened) return true;

    try {
      const source = await resolveServerMediabunnySource(this.videoPath);

      this.input = new Input({
        formats: ALL_FORMATS,
        source,
      });

      this.duration = await this.input.computeDuration().catch(() => 0);
      const videoTrack = await this.input.getPrimaryVideoTrack();
      if (!videoTrack) {
        if (this.options?.strict) {
          throw new Error(`[MediabunnyVideoDecoder] No primary video track found for ${this.videoPath}`);
        }
        return false;
      }

      const trackW = (typeof (videoTrack as any).getDisplayWidth === 'function'
        ? await (videoTrack as any).getDisplayWidth().catch(() => 1920)
        : (videoTrack as any).displayWidth) || 1920;
      const trackH = (typeof (videoTrack as any).getDisplayHeight === 'function'
        ? await (videoTrack as any).getDisplayHeight().catch(() => 1080)
        : (videoTrack as any).displayHeight) || 1080;

      if (!this.width || this.width <= 0) this.width = trackW;
      if (!this.height || this.height <= 0) this.height = trackH;

      this.canvasSink = new CanvasSink(videoTrack, {
        width: this.width,
        height: this.height,
        fit: 'fill',
        poolSize: 2,
      });

      this.isOpened = true;
      this.currentTimestampSec = 0;
      return true;
    } catch (err) {
      if (this.options?.strict) {
        throw err;
      }
      return false;
    }
  }

  public async seekTimestamp(targetSeconds: number): Promise<any | null> {
    if (!this.isOpened || !this.canvasSink) return null;
    this.currentTimestampSec = Math.max(0, targetSeconds);
    return this.renderFrameAtSec(this.currentTimestampSec);
  }

  public async readNextFrame(): Promise<any | null> {
    if (!this.isOpened || !this.canvasSink) return null;
    const frame = await this.renderFrameAtSec(this.currentTimestampSec);
    this.currentTimestampSec += 1 / this.fps;
    return frame;
  }

  private async renderFrameAtSec(sec: number): Promise<any | null> {
    if (!this.canvasSink) return null;
    try {
      const wrappedCanvas = await this.canvasSink.getCanvas(sec);
      if (!wrappedCanvas) return null;
      return typeof wrappedCanvas.getRawCanvas === 'function'
        ? wrappedCanvas.getRawCanvas()
        : wrappedCanvas.canvas || wrappedCanvas;
    } catch {
      return null;
    }
  }

  public close(): void {
    if (!this.isOpened) return;
    try {
      this.input?.dispose();
    } catch { }
    this.canvasSink = null;
    this.input = null;
    this.isOpened = false;
  }

  public [Symbol.dispose](): void {
    this.close();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.close();
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

  public createVideoDecoder(
    filePathOrUri: string,
    targetWidth: number,
    targetHeight: number,
    options?: VideoDecoderOptions
  ): IVideoDecoder {
    this.validatePrerequisites();
    return new MediabunnyVideoDecoder(filePathOrUri, targetWidth, targetHeight, options);
  }

  public createVideoSink(options?: SinkInitMetadata): IMediaFrameSink {
    return new MediabunnyServerSink();
  }

  public createAudioDecoder(): IAudioDecoder {
    return {
      decodeToPCM: async (filePathOrUri: string, targetSampleRate = 48000, targetChannels = 2): Promise<DecodedAudioPCM | null> => {
        let input: Input | null = null;
        try {
          // If FFIAudioDecoder is available in current runtime (Bun/FFI) and path is on disk, take fast native path
          try {
            if (fs.existsSync(filePathOrUri)) {
              const ffiModule = await import('../../ffmpeg-ffi/FFIAudioDecoder');
              if (ffiModule?.FFIAudioDecoder) {
                const decoded = await ffiModule.FFIAudioDecoder.decodeToPCM(filePathOrUri, targetSampleRate, targetChannels);
                if (decoded) return decoded;
              }
            }
          } catch {
            // Fall back to Mediabunny Server decoding pipeline
          }

          this.validatePrerequisites();

          const source = await resolveServerMediabunnySource(filePathOrUri);
          input = new Input({
            formats: ALL_FORMATS,
            source,
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
          } catch { }

          const durationSeconds = await input.computeDuration().catch(() => 0);
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
        } catch {
          return null;
        } finally {
          try {
            input?.dispose();
          } catch { }
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
