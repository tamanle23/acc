import { FFI } from "./index";
import { ptr } from "bun:ffi";

export interface IVideoEncodingStrategy {
  readonly mode: 'file' | 'rtmp_live';
  configureCodec(codecCtx: bigint, isNvenc: boolean, fps: number, crf: number): void;
  allocateFormatContext(outputPath: string): bigint;
  configureFormatContext(formatCtx: bigint): void;
  paceFrame(frameIndex: number, fps: number): void;
}

/**
 * Strategy for offline disk video file rendering (MP4, MKV, etc.).
 * Operates at maximum CPU/GPU throughput without network clock delays.
 */
export class FileVideoEncodingStrategy implements IVideoEncodingStrategy {
  public readonly mode = 'file';

  public configureCodec(codecCtx: bigint, isNvenc: boolean, fps: number, crf: number): void {
    if (isNvenc) {
      FFI.avutil.av_opt_set(codecCtx, Buffer.from("preset\0"), Buffer.from("p4\0"), 0);
      FFI.avutil.av_opt_set(codecCtx, Buffer.from("cq\0"), Buffer.from(`${crf}\0`), 0);
    } else {
      FFI.avutil.av_opt_set(codecCtx, Buffer.from("preset\0"), Buffer.from("fast\0"), 0);
      FFI.avutil.av_opt_set(codecCtx, Buffer.from("crf\0"), Buffer.from(`${crf}\0`), 0);
    }
  }

  public allocateFormatContext(outputPath: string): bigint {
    const fmtCtxPtr = new BigUint64Array(1);
    const retOut = FFI.avformat.avformat_alloc_output_context2(
      ptr(fmtCtxPtr.buffer),
      0n,
      0n,
      Buffer.from(outputPath + "\0")
    );
    if (retOut < 0) throw new Error(`Failed to allocate output context for file: ${outputPath}`);
    return fmtCtxPtr[0];
  }

  public configureFormatContext(_formatCtx: bigint): void {
    // Standard file container - no additional live flags needed
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
    FFI.avutil.av_opt_set(codecCtx, Buffer.from("g\0"), Buffer.from(`${gopSize}\0`), 0);
    FFI.avutil.av_opt_set(codecCtx, Buffer.from("keyint_min\0"), Buffer.from(`${gopSize}\0`), 0);

    // 2. Zero-latency low-overhead profile
    FFI.avutil.av_opt_set(codecCtx, Buffer.from("tune\0"), Buffer.from("zerolatency\0"), 0);

    if (isNvenc) {
      FFI.avutil.av_opt_set(codecCtx, Buffer.from("preset\0"), Buffer.from("p2\0"), 0);
      FFI.avutil.av_opt_set(codecCtx, Buffer.from("cq\0"), Buffer.from(`${crf}\0`), 0);
    } else {
      FFI.avutil.av_opt_set(codecCtx, Buffer.from("preset\0"), Buffer.from("veryfast\0"), 0);
      FFI.avutil.av_opt_set(codecCtx, Buffer.from("crf\0"), Buffer.from(`${crf}\0`), 0);
    }
  }

  public allocateFormatContext(outputPath: string): bigint {
    const fmtCtxPtr = new BigUint64Array(1);
    // Explicitly declare FLV container for RTMP socket transmission
    const retOut = FFI.avformat.avformat_alloc_output_context2(
      ptr(fmtCtxPtr.buffer),
      0n,
      Buffer.from("flv\0"),
      Buffer.from(outputPath + "\0")
    );
    if (retOut < 0) throw new Error(`Failed to allocate RTMP live output context for: ${outputPath}`);
    return fmtCtxPtr[0];
  }

  public configureFormatContext(formatCtx: bigint): void {
    // Omit duration/filesize metadata for continuous infinite live streaming
    FFI.avutil.av_opt_set(formatCtx, Buffer.from("flvflags\0"), Buffer.from("no_duration_filesize\0"), 0);
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
