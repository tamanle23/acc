import { dlopen, FFIType, ptr, toArrayBuffer } from "bun:ffi";
import os from "os";
import path from "path";
import { FFmpegManager } from "../FFmpegManager";

let avutil: any;
let avcodec: any;
let avformat: any;
let swscale: any;
let swresample: any;

export function initFFI() {
    if (avutil) return; // already initialized
    
    const binDir = FFmpegManager.getBinDir();
    
    // Windows DLL names based on BtbN shared builds
    const avutilPath = path.join(binDir, 'avutil-61.dll');
    const avcodecPath = path.join(binDir, 'avcodec-63.dll');
    const avformatPath = path.join(binDir, 'avformat-63.dll');
    const swscalePath = path.join(binDir, 'swscale-10.dll');
    const swresamplePath = path.join(binDir, 'swresample-7.dll');

    avutil = dlopen(avutilPath, {
        av_frame_alloc: { args: [], returns: FFIType.ptr },
        av_frame_free: { args: [FFIType.ptr], returns: FFIType.void },
        av_frame_get_buffer: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
        av_frame_unref: { args: [FFIType.ptr], returns: FFIType.void },
        av_channel_layout_default: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.void },
        av_dict_set: { args: [FFIType.ptr, FFIType.cstring, FFIType.cstring, FFIType.i32], returns: FFIType.i32 },
        av_dict_free: { args: [FFIType.ptr], returns: FFIType.void },
        av_opt_set: { args: [FFIType.ptr, FFIType.cstring, FFIType.cstring, FFIType.i32], returns: FFIType.i32 },
        av_opt_set_int: { args: [FFIType.ptr, FFIType.cstring, FFIType.i64, FFIType.i32], returns: FFIType.i32 },
        av_strerror: { args: [FFIType.i32, FFIType.ptr, FFIType.i64], returns: FFIType.i32 },
        av_rescale_q: { args: [FFIType.i64, FFIType.i64, FFIType.i64], returns: FFIType.i64 }, // Actually uses AVRational structs (8 bytes), we can pass them as i64 in bun:ffi (2x i32)
        av_malloc: { args: [FFIType.i64], returns: FFIType.ptr },
        av_freep: { args: [FFIType.ptr], returns: FFIType.void },
    });

    avcodec = dlopen(avcodecPath, {
        av_packet_alloc: { args: [], returns: FFIType.ptr },
        av_packet_free: { args: [FFIType.ptr], returns: FFIType.void },
        avcodec_find_encoder_by_name: { args: [FFIType.cstring], returns: FFIType.ptr },
        avcodec_find_decoder: { args: [FFIType.i32], returns: FFIType.ptr },
        avcodec_alloc_context3: { args: [FFIType.ptr], returns: FFIType.ptr },
        avcodec_free_context: { args: [FFIType.ptr], returns: FFIType.void },
        avcodec_open2: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        avcodec_send_frame: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        avcodec_receive_packet: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        avcodec_send_packet: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        avcodec_receive_frame: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        avcodec_parameters_alloc: { args: [], returns: FFIType.ptr },
        avcodec_parameters_free: { args: [FFIType.ptr], returns: FFIType.void },
        avcodec_parameters_to_context: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        avcodec_parameters_from_context: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        avcodec_parameters_copy: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        av_packet_unref: { args: [FFIType.ptr], returns: FFIType.void },
    });

    avformat = dlopen(avformatPath, {
        avformat_alloc_context: { args: [], returns: FFIType.ptr },
        avformat_free_context: { args: [FFIType.ptr], returns: FFIType.void },
        avformat_alloc_output_context2: { args: [FFIType.ptr, FFIType.ptr, FFIType.cstring, FFIType.cstring], returns: FFIType.i32 },
        avformat_open_input: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        avformat_find_stream_info: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        avformat_close_input: { args: [FFIType.ptr], returns: FFIType.void },
        av_read_frame: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        avio_open: { args: [FFIType.ptr, FFIType.cstring, FFIType.i32], returns: FFIType.i32 },
        avio_closep: { args: [FFIType.ptr], returns: FFIType.i32 },
        avformat_new_stream: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
        avformat_write_header: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        av_interleaved_write_frame: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        av_write_trailer: { args: [FFIType.ptr], returns: FFIType.i32 },
    });

    swscale = dlopen(swscalePath, {
        sws_getContext: { 
            args: [
                FFIType.i32, FFIType.i32, FFIType.i32, // srcW, srcH, srcFmt
                FFIType.i32, FFIType.i32, FFIType.i32, // dstW, dstH, dstFmt
                FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr // flags, srcFilter, dstFilter, param
            ], 
            returns: FFIType.ptr 
        },
        sws_scale: {
            args: [
                FFIType.ptr, // context
                FFIType.ptr, // srcSlice (uint8_t *const [])
                FFIType.ptr, // srcStride (const int [])
                FFIType.i32, // srcSliceY
                FFIType.i32, // srcSliceH
                FFIType.ptr, // dst (uint8_t *const [])
                FFIType.ptr  // dstStride (const int [])
            ],
            returns: FFIType.i32
        },
        sws_freeContext: { args: [FFIType.ptr], returns: FFIType.void }
    });

    swresample = dlopen(swresamplePath, {
        swr_alloc_set_opts2: { 
            args: [
                FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.i32, 
                FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.ptr
            ], 
            returns: FFIType.i32 
        },
        swr_init: { args: [FFIType.ptr], returns: FFIType.i32 },
        swr_convert: { 
            args: [FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.i32], 
            returns: FFIType.i32 
        },
        swr_free: { args: [FFIType.ptr], returns: FFIType.void }
    });
}

export const FFI = {
    get avutil() { initFFI(); return avutil.symbols; },
    get avcodec() { initFFI(); return avcodec.symbols; },
    get avformat() { initFFI(); return avformat.symbols; },
    get swscale() { initFFI(); return swscale.symbols; },
    get swresample() { initFFI(); return swresample.symbols; }
};

/**
 * Utility to free a pointer created by alloc functions
 */
export function freePtr(freeFunc: any, pointer: number | bigint) {
    const p = new BigUint64Array(1);
    p[0] = BigInt(pointer);
    freeFunc(ptr(p.buffer));
}

/**
 * Creates an AVRational (num, den) packed into a 64-bit int for FFI passing by value.
 */
export function makeAVRational(num: number, den: number): bigint {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setInt32(0, num, true);
    view.setInt32(4, den, true);
    return view.getBigInt64(0, true);
}

/**
 * AVPixelFormat enums
 */
export const AV_PIX_FMT_RGBA = 26;
export const AV_PIX_FMT_YUV420P = 0;

/**
 * Struct Helper functions
 */
export const Structs = {
    AVFrame: {
        setWidth: (framePtr: number | bigint, width: number) => new DataView(toArrayBuffer(framePtr, 0, 128)).setInt32(104, width, true),
        setHeight: (framePtr: number | bigint, height: number) => new DataView(toArrayBuffer(framePtr, 0, 128)).setInt32(108, height, true),
        setFormat: (framePtr: number | bigint, format: number) => new DataView(toArrayBuffer(framePtr, 0, 128)).setInt32(116, format, true),
        setPts: (framePtr: number | bigint, pts: bigint) => new DataView(toArrayBuffer(framePtr, 0, 256)).setBigInt64(136, pts, true),
        getDataPointer: (framePtr: number | bigint, plane: number = 0) => new DataView(toArrayBuffer(framePtr, 0, 64)).getBigUint64(plane * 8, true),
        getLinesize: (framePtr: number | bigint, plane: number = 0) => new DataView(toArrayBuffer(framePtr, 0, 128)).getInt32(64 + plane * 4, true)
    },
    AVPacket: {
        setPts: (pktPtr: number | bigint, pts: bigint) => new DataView(toArrayBuffer(pktPtr, 0, 64)).setBigInt64(8, pts, true),
        setDts: (pktPtr: number | bigint, dts: bigint) => new DataView(toArrayBuffer(pktPtr, 0, 64)).setBigInt64(16, dts, true),
        setStreamIndex: (pktPtr: number | bigint, index: number) => new DataView(toArrayBuffer(pktPtr, 0, 64)).setInt32(36, index, true),
    }
};

/**
 * Native Zero-Copy FFI Media Duration Probe (Replaces ffprobe.exe process calls)
 */
export function getMediaDurationFFI(filePath: string): number {
  try {
    initFFI();
    const fmtCtxPtr = new BigUint64Array(1);
    const url = Buffer.from(filePath + "\0");

    const res = FFI.avformat.avformat_open_input(ptr(fmtCtxPtr.buffer), url, 0n, 0n);
    if (res !== 0) return 0;

    const fmtCtx = fmtCtxPtr[0];
    FFI.avformat.avformat_find_stream_info(fmtCtx, 0n);

    const view = new DataView(toArrayBuffer(fmtCtx, 0, 256));
    const durationUs = view.getBigInt64(104, true);

    const p = new BigUint64Array([fmtCtx]);
    FFI.avformat.avformat_close_input(ptr(p.buffer));

    if (durationUs <= 0n) return 0;
    return Number(durationUs) / 1000000.0;
  } catch {
    return 0;
  }
}
