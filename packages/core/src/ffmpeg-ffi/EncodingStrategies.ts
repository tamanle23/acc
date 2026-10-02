import { FFI } from "./index";
import { ptr } from "bun:ffi";

export interface IVideoEncodingStrategy {
  readonly mode: 'file' | 'rtmp_live';
  configureCodec(codecCtx: bigint, isNvenc: boolean, fps: number, crf: number): void;
  allocateFormatContext(outputPath: string): bigint;
  configureFormatContext(formatCtx: bigint): void;
  paceFrame(frameIndex: number, fps: number): void;
}

export interface FileVideoEncodingOptions {
  container?: 'mp4' | 'mkv' | 'mov' | 'webm' | string;
  fastStart?: boolean;
  preset?: string;
}

/**
 * Strategy for offline disk video file rendering (MP4, MKV, WebM, MOV, etc.).
 * Dynamically resolves container format from story/pipeline config and optimizes throughput.
 */
export class FileVideoEncodingStrategy implements IVideoEncodingStrategy {
  public readonly mode = 'file';
  private container: string;
  private fastStart: boolean;
  private preset?: string;

  constructor(options: FileVideoEncodingOptions = {}) {
    this.container = options.container || 'mp4';
    this.fastStart = options.fastStart ?? (this.container === 'mp4' || this.container === 'mov');
    this.preset = options.preset;
  }

  public getContainer(): string {
    return this.container;
  }

  public isFastStart(): boolean {
    return this.fastStart;
  }

  public configureCodec(codecCtx: bigint, isNvenc: boolean, fps: number, crf: number): void {
    if (isNvenc) {
      const p = this.preset || "p4";
      FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("preset\0")), ptr(Buffer.from(`${p}\0`)), 0);
      FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("cq\0")), ptr(Buffer.from(`${crf}\0`)), 0);
    } else {
      const p = this.preset || "fast";
      FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("preset\0")), ptr(Buffer.from(`${p}\0`)), 0);
      FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("crf\0")), ptr(Buffer.from(`${crf}\0`)), 0);
    }
  }

  public allocateFormatContext(outputPath: string): bigint {
    const fmtCtxPtr = new BigUint64Array(1);

    // Resolve FFmpeg format name: matroska for mkv, webm for webm, mov for mov, mp4 for mp4
    let formatName: string | null = null;
    const ext = outputPath.split('.').pop()?.toLowerCase();
    const targetFormat = (this.container || ext || 'mp4').toLowerCase();

    if (targetFormat === 'mkv' || targetFormat === 'matroska') {
      formatName = 'matroska';
    } else if (targetFormat === 'webm') {
      formatName = 'webm';
    } else if (targetFormat === 'mov') {
      formatName = 'mov';
    } else if (targetFormat === 'mp4') {
      formatName = 'mp4';
    }

    const formatBuf = formatName ? ptr(Buffer.from(formatName + "\0")) : 0n;

    const retOut = FFI.avformat.avformat_alloc_output_context2(
      ptr(fmtCtxPtr.buffer),
      0n,
      formatBuf,
      ptr(Buffer.from(outputPath + "\0"))
    );
    if (retOut < 0) throw new Error(`Failed to allocate output context for file: ${outputPath} (format: ${targetFormat})`);
    return fmtCtxPtr[0];
  }

  public configureFormatContext(formatCtx: bigint): void {
    // For MP4 and MOV streaming, apply faststart (movflags +faststart) if enabled
    if ((this.container === 'mp4' || this.container === 'mov') && this.fastStart) {
      FFI.avutil.av_opt_set(formatCtx, ptr(Buffer.from("movflags\0")), ptr(Buffer.from("faststart\0")), 0);
    }
  }

  public paceFrame(_frameIndex: number, _fps: number): void {
    // Offline rendering runs as fast as hardware permits
  }
}

/**
 * Strategy for live RTMP streaming (YouTube Live, Twitch, RTMPS).
 * Enforces YouTube mandatory 2.0s closed GOP, FLV live container, zerolatency tuning,
 * and microsecond-accurate real-time pacing.
 */
export class RtmpLiveStreamEncodingStrategy implements IVideoEncodingStrategy {
  public readonly mode = 'rtmp_live';
  private streamStartTime: number = 0;

  public configureCodec(codecCtx: bigint, isNvenc: boolean, fps: number, crf: number): void {
    // 1. YouTube Mandatory 2-Second Closed GOP (keyframe every 2s)
    const gopSize = fps * 2;
    FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("g\0")), ptr(Buffer.from(`${gopSize}\0`)), 0);
    FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("keyint_min\0")), ptr(Buffer.from(`${gopSize}\0`)), 0);

    // 2. Zero-latency low-overhead profile
    FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("tune\0")), ptr(Buffer.from("zerolatency\0")), 0);

    if (isNvenc) {
      FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("preset\0")), ptr(Buffer.from("p2\0")), 0);
      FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("cq\0")), ptr(Buffer.from(`${crf}\0`)), 0);
    } else {
      FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("preset\0")), ptr(Buffer.from("veryfast\0")), 0);
      FFI.avutil.av_opt_set(codecCtx, ptr(Buffer.from("crf\0")), ptr(Buffer.from(`${crf}\0`)), 0);
    }
  }

  public allocateFormatContext(outputPath: string): bigint {
    const fmtCtxPtr = new BigUint64Array(1);
    // Explicitly declare FLV container for RTMP socket transmission
    const retOut = FFI.avformat.avformat_alloc_output_context2(
      ptr(fmtCtxPtr.buffer),
      0n,
      ptr(Buffer.from("flv\0")),
      ptr(Buffer.from(outputPath + "\0"))
    );
    if (retOut < 0) throw new Error(`Failed to allocate RTMP live output context for: ${outputPath}`);
    return fmtCtxPtr[0];
  }

  public configureFormatContext(formatCtx: bigint): void {
    // Omit duration/filesize metadata for continuous infinite live streaming
    FFI.avutil.av_opt_set(formatCtx, ptr(Buffer.from("flvflags\0")), ptr(Buffer.from("no_duration_filesize\0")), 0);
  }

  public paceFrame(frameIndex: number, fps: number): void {
    if (this.streamStartTime === 0) {
      this.streamStartTime = performance.now();
    } else {
      const targetTime = this.streamStartTime + (frameIndex * 1000) / fps;
      const now = performance.now();
      const sleepMs = targetTime - now;
      if (sleepMs > 1) {
        // High-precision synchronous micro-sleep without event loop thread blocking
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.floor(sleepMs));
      }
    }
  }
}
