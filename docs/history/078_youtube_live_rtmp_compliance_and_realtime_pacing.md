# History Log 078: YouTube Live RTMP Ingestion Compliance & Real-Time Clock Pacing

## Problem
When evaluating whether our `bun:ffi` RTMP pump meets YouTube Live ingestion requirements, several critical gaps were identified in `FFIVideoEncoder.ts`:
1. **Keyframe Interval (GOP)**: Defaults to x264 standard of 250 frames (~8.3 seconds). YouTube strictly mandates a closed GOP of exactly **2.0 seconds** (e.g. 60 frames at 30 fps) to avoid stream disconnection.
2. **Container Format**: `avformat_alloc_output_context2` relied on filename extensions, which fails for `rtmp://` endpoints unless explicitly formatted as `"flv"`.
3. **Transmission Rate**: The encoder wrote frames at unbounded CPU speed (100–300 fps). Pumping at unmetered speed to a network RTMP endpoint overfills YouTube's socket buffer and drops the TCP connection.

## Plan
1. Detect RTMP endpoints (`rtmp://` or `rtmps://`).
2. Configure YouTube-compliant 2.0s GOP (`g = fps * 2`, `keyint_min = fps * 2`).
3. Set low-latency FLV flags (`flvflags: "no_duration_filesize"`, `tune: "zerolatency"`).
4. Introduce real-time clock pacing via `Atomics.wait` on `SharedArrayBuffer` in `encodeRgbaFrame()`.
5. Re-export `FFIVideoEncoder` in `src/core/ffmpeg-ffi/` to maintain a single canonical implementation.

## Changes
- `packages/core/src/ffmpeg-ffi/FFIVideoEncoder.ts`:
  - Added `isRtmp` detection and `streamStartTime` tracker.
  - Enforced 2.0-second GOP (`g = this.fps * 2`, `keyint_min = this.fps * 2`).
  - Allocated `"flv"` output format context for RTMP targets with `no_duration_filesize`.
  - Added millisecond-accurate real-time pacing using `Atomics.wait`.
- `src/core/ffmpeg-ffi/FFIVideoEncoder.ts`: Re-exported from `packages/core/src/ffmpeg-ffi/FFIVideoEncoder`.

## Verification
1. Full 7-file test suite (`phase0` through `phase5`) passed 36/36 tests with zero failures in 17.02s.
2. `bun run cli.ts ./sample-story` completed in 4.7s with exact baseline match.

## Tasks
- [x] Configure 2s closed GOP on H.264 context.
- [x] Configure FLV container and zero-latency tuning for RTMP.
- [x] Implement real-time clock pacing for continuous stream pumping.
