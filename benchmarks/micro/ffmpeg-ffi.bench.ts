import { run, bench, group } from 'mitata';
import { FFmpegManager } from '../../packages/core/src/FFmpegManager';
import { FFI, freePtr, makeAVRational, safeArrayBuffer } from '../../packages/core/src/ffmpeg-ffi';

// Ensure FFmpeg binaries and symbols are prepared at top-level
await FFmpegManager.prepare();

group('FFmpeg Zero-Copy bun:ffi C-Bindings', () => {
  bench('FFmpeg AVFrame C-Struct Allocation & Free (av_frame_alloc/free)', () => {
    const framePtr = FFI.avutil.av_frame_alloc();
    freePtr(FFI.avutil.av_frame_free, framePtr);
  });

  bench('FFmpeg AVPacket C-Struct Allocation & Free (av_packet_alloc/free)', () => {
    const pktPtr = FFI.avcodec.av_packet_alloc();
    freePtr(FFI.avcodec.av_packet_free, pktPtr);
  });

  bench('FFmpeg Timestamp Rescale (av_rescale_q via FFI)', () => {
    const pts = 1000n;
    const srcTb = makeAVRational(1, 30);
    const dstTb = makeAVRational(1, 1000);
    const res = FFI.avutil.av_rescale_q(pts, srcTb, dstTb);
  });

  bench('Zero-Copy ArrayBuffer View from C Pointer (safeArrayBuffer)', () => {
    const framePtr = FFI.avutil.av_frame_alloc();
    const buf = safeArrayBuffer(framePtr, 0, 128);
    freePtr(FFI.avutil.av_frame_free, framePtr);
  });
});

if (import.meta.main) {
  run();
}
