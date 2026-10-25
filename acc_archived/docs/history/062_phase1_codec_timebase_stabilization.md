# [062] Phase 1: Codec TimeBase, Timestamp & Zero-Copy Encoding Stabilization

## 1. Context & Problem Statement
During initial testing of the FFI encoder, video encoding failed with:
`[libx264] The encoder timebase is not set` / `[libx264] dimensions not set` and segfaulted on exit.
This forced the 3D Depth engine to fall back to the 2D render loop. To eliminate process spawning completely, Phase 1 requires stabilizing the native `bun:ffi` video encoder.

## 2. Implementation Plan
- Correctly initialize `AVCodecContext` with:
  - `AVCodecParameters` bridging: mapped `format` (offset 44), `width` (offset 72), `height` (offset 76) via `avcodec_parameters_alloc()`, `avcodec_parameters_to_context()`.
  - Configured `time_base` via `av_opt_set(ctx, "time_base", "1/fps", 0)`.
  - Configured `framerate` via `av_opt_set(ctx, "framerate", "fps/1", 0)`.
  - Configured hardware NVENC GPU with automatic fallback to CPU `libx264`.
- Correctly open container IO:
  - `avio_open(formatCtx + 32n, ...)` directly addressing `formatCtx->pb`.
  - Stream header writing via `avformat_write_header`.
- Fix memory cleanup in `close()`:
  - Pass single pointer to `avformat_free_context` and double pointers to `avcodec_free_context`, `av_frame_free`, `av_packet_free`.

## 3. Changes Made
- `src/core/ffmpeg-ffi/index.ts`: Added bindings for `avcodec_parameters_alloc`, `avcodec_parameters_free`, `avcodec_parameters_to_context`. Fixed `setPts` buffer size to 256 bytes and offset to 136.
- `src/core/ffmpeg-ffi/FFIVideoEncoder.ts`: Rewrote initialization and close methods with exact pointer handling and hardware GPU NVENC support.

## 4. Verification & Walkthrough
Ran isolated in-memory test generating 30 RGBA frames:
- Successfully encoded 30 frames at 1280x720 30fps.
- Generated valid `output_ffi_test.mp4` (Size: 7548 bytes) with exit code 0 and zero memory faults.
