import { run, bench, group } from 'mitata';
import { ptr } from 'bun:ffi';
import { FFmpegManager } from '../../packages/core/src/FFmpegManager';
import { FFI, freePtr, makeAVRational, safeArrayBuffer, Structs, AV_PIX_FMT_RGBA } from '../../packages/core/src/ffmpeg-ffi';

// Ensure FFmpeg binaries and symbols are prepared at top-level
await FFmpegManager.prepare();

group('FFmpeg Zero-Copy bun:ffi C-Bindings & Struct Operations', () => {
  const encoderNameBuf = Buffer.from('libx264\0');

  bench('FFmpeg AVFrame Allocation & Free (av_frame_alloc/free)', () => {
    const framePtr = FFI.avutil.av_frame_alloc();
    freePtr(FFI.avutil.av_frame_free, framePtr);
  });

  bench('FFmpeg AVPacket Allocation & Free (av_packet_alloc/free)', () => {
    const pktPtr = FFI.avcodec.av_packet_alloc();
    freePtr(FFI.avcodec.av_packet_free, pktPtr);
  });

  bench('FFmpeg AVFormatContext Allocation & Free (avformat_alloc/free_context)', () => {
    const fmtCtx = FFI.avformat.avformat_alloc_context();
    FFI.avformat.avformat_free_context(fmtCtx);
  });

  bench('FFmpeg Encoder Lookup by Name (avcodec_find_encoder_by_name libx264)', () => {
    const codecPtr = FFI.avcodec.avcodec_find_encoder_by_name(ptr(encoderNameBuf));
  });

  bench('FFmpeg AVCodecContext Allocation & Free (avcodec_alloc_context3/free)', () => {
    const codecPtr = FFI.avcodec.avcodec_find_encoder_by_name(ptr(encoderNameBuf));
    if (codecPtr) {
      const codecCtx = FFI.avcodec.avcodec_alloc_context3(codecPtr);
      const ctxPtrArr = new BigUint64Array([codecCtx]);
      FFI.avcodec.avcodec_free_context(ptr(ctxPtrArr.buffer));
    }
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

  bench('FFmpeg Structs.AVFrame Field Mutators (width, height, format, pts)', () => {
    const framePtr = FFI.avutil.av_frame_alloc();
    Structs.AVFrame.setWidth(framePtr, 1920);
    Structs.AVFrame.setHeight(framePtr, 1080);
    Structs.AVFrame.setFormat(framePtr, AV_PIX_FMT_RGBA);
    Structs.AVFrame.setPts(framePtr, 300n);
    freePtr(FFI.avutil.av_frame_free, framePtr);
  });
});

if (import.meta.main) {
  run();
}
