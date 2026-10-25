# Zero-Copy 4K Video Processing with `bun:ffi` and FFmpeg

## 1. Architectural Overview & The Problem Statement

Processing high-throughput video streams in high-level managed runtimes presents severe memory bandwidth and garbage collection (GC) bottlenecks:

- A single uncompressed 8-bit YUV420p frame at 4K resolution ($3840 \times 2160$) requires:
  $$\text{Size} = 3840 \times 2160 \times 1.5 \approx 12.44 \text{ MB}$$
- At 60 frames per second (FPS), raw frame throughput reaches:
  $$\text{Throughput} \approx 12.44 \text{ MB} \times 60 \approx 746.5 \text{ MB/s}$$

Traditional approaches spawn external FFmpeg processes via standard pipes (`child_process.spawn("ffmpeg", ...)`). This results in multiple buffer copies across kernel and IPC boundaries, immediate heap pressure, and unpredictable JavaScript garbage collector stalls.

```
Conventional Pipe Architecture (Copy-Heavy):
[FFmpeg Process] ---> [Kernel Pipe Buffer] ---> [Node/Bun Process Heap] ---> [TypedArray Allocation]
      (Native)              (Kernel Copy)                (IPC Copy)                  (GC Pressure)

Zero-Copy bun:ffi Architecture:
[FFmpeg C Dynamic Library] <-------------------- [bun:ffi Direct Pointer View]
      (Native Heap)         (Pointer Reference)     (TypedArray over C Memory)
```

By interfacing directly with the native FFmpeg dynamic libraries (`libavcodec`, `libavformat`, `libavutil`) through `bun:ffi`, we access underlying video plane pointers directly via `Uint8Array` views without native-to-JS memory duplication.

---

## 2. Native C Shim Layer

FFmpeg's struct definitions (`AVFrame`, `AVCodecContext`) frequently shift internal field offsets across minor and major releases (FFmpeg 5, 6, and 7). Relying on raw offset math within JavaScript is fragile. A thin, high-performance C shim ensures an immutable, stable C Application Binary Interface (ABI).

### `shim.h`
```c
#ifndef FFMPEG_SHIM_H
#define FFMPEG_SHIM_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct VideoPipeline VideoPipeline;

VideoPipeline* pipeline_create(const char *filepath);
int pipeline_read_frame(VideoPipeline *pipe);
uint8_t* pipeline_get_plane_ptr(VideoPipeline *pipe, int plane_idx);
int pipeline_get_linesize(VideoPipeline *pipe, int plane_idx);
int pipeline_get_width(VideoPipeline *pipe);
int pipeline_get_height(VideoPipeline *pipe);
int64_t pipeline_get_pts(VideoPipeline *pipe);
void pipeline_destroy(VideoPipeline *pipe);

#ifdef __cplusplus
}
#endif

#endif // FFMPEG_SHIM_H
```

### `shim.c`
```c
#include "shim.h"
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/imgutils.h>
#include <stdlib.h>

struct VideoPipeline {
    AVFormatContext *fmt_ctx;
    AVCodecContext *codec_ctx;
    AVFrame *frame;
    AVPacket *pkt;
    int video_stream_idx;
};

VideoPipeline* pipeline_create(const char *filepath) {
    if (!filepath) return NULL;

    VideoPipeline *pipe = (VideoPipeline*)calloc(1, sizeof(VideoPipeline));
    if (!pipe) return NULL;

    if (avformat_open_input(&pipe->fmt_ctx, filepath, NULL, NULL) < 0) {
        free(pipe);
        return NULL;
    }

    if (avformat_find_stream_info(pipe->fmt_ctx, NULL) < 0) {
        avformat_close_input(&pipe->fmt_ctx);
        free(pipe);
        return NULL;
    }

    pipe->video_stream_idx = -1;
    const AVCodec *codec = NULL;
    for (unsigned int i = 0; i < pipe->fmt_ctx->nb_streams; i++) {
        if (pipe->fmt_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
            pipe->video_stream_idx = (int)i;
            codec = avcodec_find_decoder(pipe->fmt_ctx->streams[i]->codecpar->codec_id);
            break;
        }
    }

    if (pipe->video_stream_idx == -1 || !codec) {
        avformat_close_input(&pipe->fmt_ctx);
        free(pipe);
        return NULL;
    }

    pipe->codec_ctx = avcodec_alloc_context3(codec);
    if (!pipe->codec_ctx) {
        avformat_close_input(&pipe->fmt_ctx);
        free(pipe);
        return NULL;
    }

    avcodec_parameters_to_context(pipe->codec_ctx, pipe->fmt_ctx->streams[pipe->video_stream_idx]->codecpar);
    
    // Leverage all available CPU cores for multi-threaded slice/frame decoding
    pipe->codec_ctx->thread_count = 0;

    if (avcodec_open2(pipe->codec_ctx, codec, NULL) < 0) {
        avcodec_free_context(&pipe->codec_ctx);
        avformat_close_input(&pipe->fmt_ctx);
        free(pipe);
        return NULL;
    }

    pipe->frame = av_frame_alloc();
    pipe->pkt = av_packet_alloc();

    if (!pipe->frame || !pipe->pkt) {
        pipeline_destroy(pipe);
        return NULL;
    }

    return pipe;
}

int pipeline_read_frame(VideoPipeline *pipe) {
    if (!pipe) return -1;

    while (av_read_frame(pipe->fmt_ctx, pipe->pkt) >= 0) {
        if (pipe->pkt->stream_index == pipe->video_stream_idx) {
            int ret = avcodec_send_packet(pipe->codec_ctx, pipe->pkt);
            av_packet_unref(pipe->pkt);
            if (ret < 0) return ret;

            ret = avcodec_receive_frame(pipe->codec_ctx, pipe->frame);
            if (ret >= 0) return 0; // Valid decoded frame available
            if (ret != AVERROR(EAGAIN)) return ret;
        } else {
            av_packet_unref(pipe->pkt);
        }
    }

    return -1; // EOF reached or stream error
}

uint8_t* pipeline_get_plane_ptr(VideoPipeline *pipe, int plane_idx) {
    if (!pipe || !pipe->frame || plane_idx < 0 || plane_idx >= AV_NUM_DATA_POINTERS) {
        return NULL;
    }
    return pipe->frame->data[plane_idx];
}

int pipeline_get_linesize(VideoPipeline *pipe, int plane_idx) {
    if (!pipe || !pipe->frame || plane_idx < 0 || plane_idx >= AV_NUM_DATA_POINTERS) {
        return 0;
    }
    return pipe->frame->linesize[plane_idx];
}

int pipeline_get_width(VideoPipeline *pipe) {
    return pipe && pipe->codec_ctx ? pipe->codec_ctx->width : 0;
}

int pipeline_get_height(VideoPipeline *pipe) {
    return pipe && pipe->codec_ctx ? pipe->codec_ctx->height : 0;
}

int64_t pipeline_get_pts(VideoPipeline *pipe) {
    return pipe && pipe->frame ? pipe->frame->pts : 0;
}

void pipeline_destroy(VideoPipeline *pipe) {
    if (!pipe) return;
    if (pipe->frame) av_frame_free(&pipe->frame);
    if (pipe->pkt) av_packet_free(&pipe->pkt);
    if (pipe->codec_ctx) avcodec_free_context(&pipe->codec_ctx);
    if (pipe->fmt_ctx) avformat_close_input(&pipe->fmt_ctx);
    free(pipe);
}
```

### Compilation
Compile the dynamic shared object with optimization flags (`-O3`):

```bash
# Linux (ELF .so)
clang -O3 -shared -fPIC shim.c -lavformat -lavcodec -lavutil -o libffmpeg_shim.so

# macOS (Mach-O .dylib)
clang -O3 -dynamiclib shim.c $(pkg-config --cflags --libs libavformat libavcodec libavutil) -o libffmpeg_shim.dylib
```

---

## 3. High-Performance TypeScript Implementation

The TypeScript layer loads the compiled shared library via `bun:ffi` and wraps raw pointers into non-allocating typed array memory views using `toArrayBuffer()`.

### `video_decoder.ts`
```typescript
import { dlopen, FFIType, ptr, toArrayBuffer, CString } from "bun:ffi";

const libPath = process.platform === "darwin" ? "./libffmpeg_shim.dylib" : "./libffmpeg_shim.so";

const native = dlopen(libPath, {
  pipeline_create: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  pipeline_read_frame: {
    args: [FFIType.ptr],
    returns: FFIType.i32,
  },
  pipeline_get_plane_ptr: {
    args: [FFIType.ptr, FFIType.i32],
    returns: FFIType.ptr,
  },
  pipeline_get_linesize: {
    args: [FFIType.ptr, FFIType.i32],
    returns: FFIType.i32,
  },
  pipeline_get_width: {
    args: [FFIType.ptr],
    returns: FFIType.i32,
  },
  pipeline_get_height: {
    args: [FFIType.ptr],
    returns: FFIType.i32,
  },
  pipeline_get_pts: {
    args: [FFIType.ptr],
    returns: FFIType.i64,
  },
  pipeline_destroy: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
});

export interface ZeroCopyFrame {
  width: number;
  height: number;
  pts: bigint;
  yPlane: Uint8Array;
  uPlane: Uint8Array;
  vPlane: Uint8Array;
  strides: {
    y: number;
    u: number;
    v: number;
  };
}

export class VideoDecoder {
  private pipelinePtr: number | null = null;
  public readonly width: number;
  public readonly height: number;

  constructor(filePath: string) {
    const pathCString = new CString(filePath);
    const rawPtr = native.symbols.pipeline_create(pathCString.ptr);

    if (!rawPtr) {
      throw new Error(`Failed to initialize FFmpeg pipeline for: ${filePath}`);
    }

    this.pipelinePtr = Number(rawPtr);
    this.width = native.symbols.pipeline_get_width(this.pipelinePtr);
    this.height = native.symbols.pipeline_get_height(this.pipelinePtr);
  }

  /**
   * Advances the decoder to the next frame.
   * Returns a zero-copy typed view over native frame planes, or null on EOF.
   */
  public nextFrame(): ZeroCopyFrame | null {
    if (!this.pipelinePtr) {
      throw new Error("Decoder is closed or invalid.");
    }

    const ret = native.symbols.pipeline_read_frame(this.pipelinePtr);
    if (ret !== 0) {
      return null; // Stream EOF or decoding terminated
    }

    const yPtr = native.symbols.pipeline_get_plane_ptr(this.pipelinePtr, 0);
    const uPtr = native.symbols.pipeline_get_plane_ptr(this.pipelinePtr, 1);
    const vPtr = native.symbols.pipeline_get_plane_ptr(this.pipelinePtr, 2);

    const yStride = native.symbols.pipeline_get_linesize(this.pipelinePtr, 0);
    const uStride = native.symbols.pipeline_get_linesize(this.pipelinePtr, 1);
    const vStride = native.symbols.pipeline_get_linesize(this.pipelinePtr, 2);

    const pts = BigInt(native.symbols.pipeline_get_pts(this.pipelinePtr));
    const chromaHeight = this.height >> 1; // 4:2:0 subsampling

    // Construct TypedArray views directly over the raw native memory addresses
    const yPlane = new Uint8Array(toArrayBuffer(yPtr, yStride * this.height));
    const uPlane = new Uint8Array(toArrayBuffer(uPtr, uStride * chromaHeight));
    const vPlane = new Uint8Array(toArrayBuffer(vPtr, vStride * chromaHeight));

    return {
      width: this.width,
      height: this.height,
      pts,
      yPlane,
      uPlane,
      vPlane,
      strides: {
        y: yStride,
        u: uStride,
        v: vStride,
      },
    };
  }

  public close(): void {
    if (this.pipelinePtr) {
      native.symbols.pipeline_destroy(this.pipelinePtr);
      this.pipelinePtr = null;
    }
  }
}
```

---

## 4. In-Place Zero-Copy Mutation Engine

Because the `Uint8Array` view points directly to the underlying `AVFrame->data` buffer allocated by FFmpeg, modifying this array updates the C-level memory in-place.

To maximize throughput across $8,294,400$ luma pixels per frame, process chunks using 64-bit word operations (`BigUint64Array`) rather than byte-by-byte iteration.

### `processor.ts`
```typescript
import { VideoDecoder } from "./video_decoder";

const decoder = new VideoDecoder("input_4k_sample.mp4");
console.log(`Initialized 4K Stream: ${decoder.width}x${decoder.height}`);

let framesProcessed = 0;
const startMark = performance.now();

while (true) {
  const frame = decoder.nextFrame();
  if (!frame) break;

  const { yPlane, strides, height } = frame;
  const lumaByteLength = strides.y * height;

  // View the exact same underlying memory as 64-bit integer words
  const wordsCount = Math.floor(lumaByteLength / 8);
  const u64View = new BigUint64Array(yPlane.buffer, yPlane.byteOffset, wordsCount);

  // In-place bitwise inversion transformation (8 pixels per iteration)
  for (let i = 0; i < wordsCount; i++) {
    u64View[i] = ~u64View[i];
  }

  framesProcessed++;
}

const elapsedMs = performance.now() - startMark;
const fps = (framesProcessed / (elapsedMs / 1000)).toFixed(2);

console.log(`Processed ${framesProcessed} frames in ${elapsedMs.toFixed(2)}ms (${fps} FPS) with zero heap copies.`);
decoder.close();
```

---

## 5. Memory Management & Synchronization Directives

### 1. Pointer Invalidation & Buffer Recycling
FFmpeg's internal frame pools reuse underlying buffers across decode iterations (`avcodec_receive_frame`). 
- **Rule:** A `Uint8Array` view over `AVFrame->data` is only valid during the lifecycle of the current tick. 
- Retaining references to a past frame's `Uint8Array` without explicit cloning causes dynamic data corruption when the decoder reuses that memory slice for future frames.

### 2. Line Padding & Memory Strides
Decoders align rows to SIMD-friendly boundaries (typically 32-byte or 64-byte alignments). 
- Consequently, `linesize[0]` (stride) is often larger than `width`.
- Never compute row offset as `y * width`. Always index as:
  $$\text{Index}(x, y) = y \times \text{linesize} + x$$
- Ignoring line padding produces image shearing and memory access violations.

### 3. Concurrency via Bun Workers
For multi-threaded video processing architectures, avoid running long decode loops on the main event loop. Run the `VideoDecoder` inside a Bun background worker (`Worker`), passing decoded telemetry, metadata, or hardware-encoded buffers downstream via transferable objects.