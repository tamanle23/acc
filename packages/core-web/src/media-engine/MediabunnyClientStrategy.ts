import { MediabunnyClientSink } from './MediabunnyClientSink';
import {
  Input,
  ALL_FORMATS,
  BlobSource,
  BufferSource,
  UrlSource,
  AudioSampleSink,
  CanvasSink,
} from 'mediabunny';
import {
  IMediaEngineStrategy,
  MediaEngineType,
  MediaEngineCapabilities,
  IMediaFrameSink,
  IAudioDecoder,
  IVideoDecoder,
  VideoDecoderOptions,
  DecodedAudioPCM,
  AssetProtocolRegistry,
  IMediaProbeStrategy,
  IMediaConcatStrategy,
  IAudioMuxerStrategy,
  IChunkExecutionPolicy,
  MediaProbeResult,
  SinkInitMetadata,
} from '@acc/core-isomorphic';
import { MediaEngineError } from '@acc/core-isomorphic';

export class MediabunnyClientProbeStrategy implements IMediaProbeStrategy {
  public async probe(filePathOrUrl: string): Promise<MediaProbeResult> {
    throw new MediaEngineError(
      'mediabunny-client',
      `Client-side media probing for "${filePathOrUrl}" is not supported without a Web Blob/URL source.`
    );
  }
}

export class MediabunnyClientConcatStrategy implements IMediaConcatStrategy {
  public async concatenate(_inputPaths: string[], _outputPath: string): Promise<void> {
    throw new MediaEngineError(
      'mediabunny-client',
      'Lossless container concatenation of disk paths is unavailable in client browser runtime.'
    );
  }
}

export class MediabunnyClientAudioMuxerStrategy implements IAudioMuxerStrategy {
  public async muxAudioVideo(_videoPath: string, _audioPath: string, _outputPath: string): Promise<void> {
    throw new MediaEngineError(
      'mediabunny-client',
      'Direct container audio multiplexing via native FFI is unavailable in client browser runtime. Audio mixing is handled via WebAudio and MediabunnyClientSink.'
    );
  }
}

export class MediabunnyClientChunkPolicy implements IChunkExecutionPolicy {
  public readonly supportsParallelExecution = true;
  public readonly executionMode = 'web-worker';

  public getOptimalConcurrency(totalChunks: number, systemCores: number): number {
    const cores = Math.max(1, systemCores || 4);
    return Math.min(totalChunks, cores);
  }
}

/**
 * Resolves media URI or path to a valid Mediabunny Source instance for client browser / Web Worker.
 * Strictly WinterTC (ECMA-429) compliant with zero Node.js built-ins.
 * Supports cache:// (OPFS/IndexedDB), blob:, http(s)://, and data: URIs.
 */
export async function resolveClientMediabunnySource(uriOrPath: string): Promise<any> {
  const registry = AssetProtocolRegistry.getInstance();
  const asset = registry.resolve(uriOrPath);

  // 1. Remote HTTP / HTTPS URLs (Network progressive streaming via Range requests)
  if (uriOrPath.startsWith('http://') || uriOrPath.startsWith('https://')) {
    return new UrlSource(uriOrPath);
  }

  // 2. Blob or Cached Asset (OPFS / IndexedDB / Memory cache)
  if (typeof asset.blob === 'function') {
    try {
      const blob = await asset.blob();
      if (blob) {
        return new BlobSource(blob);
      }
    } catch {
      // Fall through to arrayBuffer or fetch
    }
  }

  // 3. ArrayBuffer fallback
  if (typeof asset.arrayBuffer === 'function') {
    try {
      const ab = await asset.arrayBuffer();
      if (ab) {
        return new BufferSource(ab);
      }
    } catch {
      // Fall through to fetch
    }
  }

  // 4. Fetch fallback for absolute or relative network/blob URLs (NEVER for cache: or file:)
  if (
    typeof fetch !== 'undefined' &&
    !uriOrPath.startsWith('cache:') &&
    !uriOrPath.startsWith('file:')
  ) {
    try {
      const res = await fetch(uriOrPath);
      if (res.ok) {
        const blob = await res.blob();
        return new BlobSource(blob);
      }
    } catch {
      // Network fetch failure
    }
  }

  throw new Error(`[resolveClientMediabunnySource] Unable to resolve client media source for URI: ${uriOrPath}`);
}

/**
 * MediabunnyClientVideoDecoder:
 * Decodes video files frame-by-frame or via random-access seeking leveraging mediabunny.CanvasSink.
 * Provides 100% strategy parity with FFIVideoDecoder and MediabunnyVideoDecoder for browser / Web Worker runtimes.
 * Strictly WinterTC (ECMA-429) compliant with zero Node.js dependencies.
 */
export class MediabunnyClientVideoDecoder implements IVideoDecoder {
  private input: Input | null = null;
  private canvasSink: CanvasSink | null = null;
  private videoTrack: any = null;
  private isOpened = false;
  private currentTimestampSec = 0;
  private fps = 30;
  public readonly width: number;
  public readonly height: number;
  public duration: number = 0;
  private options?: VideoDecoderOptions;

  constructor(
    private uriOrPath: string,
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
      const source = await resolveClientMediabunnySource(this.uriOrPath);

      this.input = new Input({
        formats: ALL_FORMATS,
        source,
      });

      this.duration = await this.input.computeDuration().catch(() => 0);
      const videoTrack = await this.input.getPrimaryVideoTrack();
      if (!videoTrack) {
        if (this.options?.strict) {
          throw new Error(`[MediabunnyClientVideoDecoder] No primary video track found for ${this.uriOrPath}`);
        }
        return false;
      }

      this.videoTrack = videoTrack;
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

  public async getFrameAtSeconds(sec: number): Promise<any | null> {
    return this.renderFrameAtSec(sec);
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

  public getRawTrack(): any {
    return this.videoTrack;
  }

  public getCanvasSink(): CanvasSink | null {
    return this.canvasSink;
  }

  public getInput(): Input | null {
    return this.input;
  }

  public close(): void {
    if (!this.isOpened) return;
    try {
      this.input?.dispose();
    } catch { }
    this.canvasSink = null;
    this.videoTrack = null;
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
 * Mediabunny Client Media Engine Strategy.
 * Designed for pure browser / WebCodecs environments (apps/studio) without requiring native binaries.
 */
export class MediabunnyClientStrategy implements IMediaEngineStrategy {
  public readonly id = MediaEngineType.MediabunnyClient;
  public readonly name: string = 'Mediabunny Client Engine (WebCodecs & Browser Blob)';

  public readonly capabilities: MediaEngineCapabilities = {
    supportsZeroCopyFFI: false,
    supportsComplexFilters: false,
    supportsRawFrameStream: true,
    supportsBrowserRuntime: true,
    requiresNativeBinaries: false,
  };

  private probeStrategy = new MediabunnyClientProbeStrategy();
  private concatStrategy = new MediabunnyClientConcatStrategy();
  private audioMuxerStrategy = new MediabunnyClientAudioMuxerStrategy();
  private chunkPolicy = new MediabunnyClientChunkPolicy();

  public validatePrerequisites(): void {
    // In browser: check window.VideoEncoder. In Node/Bun: verify NodeAV/WebCodecs availability
    const hasBrowserWebCodecs = typeof globalThis !== 'undefined' && typeof (globalThis as any).VideoEncoder !== 'undefined';
    const hasNode = typeof process !== 'undefined' && process.versions != null;

    if (!hasBrowserWebCodecs && !hasNode) {
      throw new MediaEngineError(
       this.id,
        'WebCodecs (VideoEncoder) is not supported in this runtime environment.'
      );
    }
  }

  public createVideoDecoder(
    filePathOrUri: string,
    targetWidth: number,
    targetHeight: number,
    options?: VideoDecoderOptions
  ): IVideoDecoder {
    this.validatePrerequisites();
    return new MediabunnyClientVideoDecoder(filePathOrUri, targetWidth, targetHeight, options);
  }

  public createVideoSink(_options?: SinkInitMetadata): IMediaFrameSink {
    return new MediabunnyClientSink();
  }

  public createAudioDecoder(): IAudioDecoder {
    return {
      decodeToPCM: async (uriOrPath: string, targetSampleRate = 48000, targetChannels = 2): Promise<DecodedAudioPCM | null> => {
        try {
          // 1. Resolve raw bytes or Blob via AssetProtocolRegistry or fetch
          let blob: Blob | undefined;
          let arrayBuffer: ArrayBuffer | undefined;

          try {
            const registry = AssetProtocolRegistry.getInstance();
            const asset = registry.resolve(uriOrPath);
            if (asset && typeof asset.arrayBuffer === 'function') {
              arrayBuffer = await asset.arrayBuffer();
            } else if (asset && typeof asset.blob === 'function') {
              blob = await asset.blob();
              arrayBuffer = await blob.arrayBuffer();
            }
          } catch {
            // Fall back to standard fetch if protocol registry is not registered for URI
          }

          if (!arrayBuffer) {
            if (typeof fetch !== 'undefined') {
              const res = await fetch(uriOrPath);
              if (res.ok) {
                arrayBuffer = await res.arrayBuffer();
              }
            }
          }

          if (!blob && arrayBuffer) {
            blob = new Blob([arrayBuffer]);
          }

          // Capability & Container Inspection:
          // Video container formats (MP4, MKV, WebM, MOV) contain multiplexed video/audio tracks.
          // They should route directly to Mediabunny's container demuxer (Input + AudioSampleSink),
          // whereas standalone audio formats (WAV, MP3, OGG, AAC, FLAC) decode fastest via OfflineAudioContext.
          const cleanUri = uriOrPath.split('?')[0].toLowerCase();
          const isVideoContainer =
            cleanUri.endsWith('.mp4') ||
            cleanUri.endsWith('.webm') ||
            cleanUri.endsWith('.mkv') ||
            cleanUri.endsWith('.mov') ||
            (blob?.type && (blob.type.includes('video/') || blob.type === 'video/mp4' || blob.type === 'video/webm'));

          // 2. Decode using Web Audio OfflineAudioContext for standalone audio files
          const OfflineCtx = (globalThis as any).OfflineAudioContext || (globalThis as any).webkitOfflineAudioContext;
          if (!isVideoContainer && OfflineCtx && arrayBuffer) {
            try {
              // Decode audio data to obtain original sampleRate and channel buffers
              const offlineContext = new OfflineCtx(2, 48000, targetSampleRate);
              const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer.slice(0));

              const numChannels = audioBuffer.numberOfChannels;
              const numFrames = audioBuffer.length;
              const leftChannel = audioBuffer.getChannelData(0);
              const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

              const interleaved = new Float32Array(numFrames * 2);
              for (let i = 0; i < numFrames; i++) {
                interleaved[i * 2] = leftChannel[i];
                interleaved[i * 2 + 1] = rightChannel[i];
              }

              return {
                sampleRate: audioBuffer.sampleRate,
                channels: 2,
                totalSamplesPerChannel: numFrames,
                durationSeconds: audioBuffer.duration,
                data: interleaved,
              };
            } catch {
              // Fall through to Mediabunny demuxer if OfflineAudioContext rejects the format
            }
          }

          // 3. Decode via Mediabunny Input + AudioSampleSink (Video containers, or fallback when Web Audio is unavailable)
          let inputSource: any;
          if (blob) {
            inputSource = new BlobSource(blob);
          } else if (arrayBuffer) {
            inputSource = new BlobSource(new Blob([arrayBuffer]));
          } else if (typeof fetch !== 'undefined') {
            try {
              const res = await fetch(uriOrPath);
              if (res.ok) {
                const ab = await res.arrayBuffer();
                inputSource = new BlobSource(new Blob([ab]));
              } else {
                inputSource = new UrlSource(uriOrPath);
              }
            } catch {
              inputSource = new UrlSource(uriOrPath);
            }
          } else {
            inputSource = new UrlSource(uriOrPath);
          }

          let input: Input | null = null;
          try {
            input = new Input({
              formats: ALL_FORMATS,
              source: inputSource,
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
          } finally {
            try {
              input?.dispose();
            } catch {}
          }
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
