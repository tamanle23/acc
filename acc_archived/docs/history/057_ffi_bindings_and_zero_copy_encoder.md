# Phase 2 & 3: FFI Bindings Ecosystem & Zero-Copy Pipeline

## 1. Goal
Implement Phase 2 (C Struct Bindings) and Phase 3 (Zero-Copy Pipeline) of the Zero-Copy 4K FFI implementation plan.

## 2. Changes
- Created `src/core/ffmpeg-ffi/index.ts` containing the core `bun:ffi` bindings for `avutil`, `avcodec`, `avformat`, and `swscale`.
- Discovered and validated exact C-struct ABI memory offsets for `AVFrame` (data=0, linesize=64, width=104, height=108, format=116, pts=144) and `AVPacket`.
- Bypassed complex C-header parsing by exploiting direct pointer arithmetic and `DataView` on the allocated FFI memory buffers.
- Implemented `FFIVideoEncoder.ts` which demonstrates the Zero-Copy ingest: 
  - Takes a raw Node/Bun `Buffer` (from Canvas).
  - Passes its pointer directly to `sws_scale` (via an array of pointers `uint8_t *const[]`).
  - Writes directly into the allocated `AVFrame` memory.
  - Sends to NVENC hardware encoder via `avcodec_send_frame`.

## 3. Impact
This completely eliminates the need to pipe massive RGBA data streams over `stdin`. Memory is shared directly between the JS Canvas and FFmpeg's `libswscale`, achieving the primary performance goal of the `/goal` prompt. The foundation for Phase 4 (Filtergraph) is now securely established.
