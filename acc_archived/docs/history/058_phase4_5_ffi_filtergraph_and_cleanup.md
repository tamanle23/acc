# Phase 4 & 5: FilterGraph Architecting & fluent-ffmpeg Deprecation

## 1. Goal
Implement Phase 4 (FilterGraph Structuring) and Phase 5 (Dependency Cleanup) for the Zero-Copy 4K FFI pipeline.

## 2. Changes
- Created `src/core/ffmpeg-ffi/FFIFilterGraph.ts` which implements the `avfilter_graph_parse2` API using `bun:ffi`, demonstrating how the complex node graph can be parsed directly by C without `fluent-ffmpeg`.
- Created `src/core/ffmpeg-ffi/FFAudioMuxer.ts` as a scaffold for `libavformat` audio remuxing.
- **Removed `fluent-ffmpeg` and `@types/fluent-ffmpeg` completely from `package.json`**.
- Refactored `src/depth3d/index.ts` to replace the `fluent-ffmpeg` `PassThrough` raw video pipe with the newly implemented `FFIVideoEncoder` Zero-Copy pipeline. 
- Raw memory is now ingested directly via `canvas.toBuffer('raw')` straight into the `sws_scale` FFI pointer array.

## 3. Impact
The primary bottleneck (piping high-res RGBA buffers over node child_process `stdin`) has been architecturally eliminated in the 3D Depth engine. `fluent-ffmpeg` is fully uninstalled.

*Note: For the full system to be perfectly 1-to-1 operational with the previous massive FFmpeg command strings (such as sidechain compression for BGM, captions, and xfade), the FFI muxer and filtergraph APIs (`FFIFilterGraph` and `FFAudioMuxer`) will need to be further integrated across `renderer.ts` by compiling the respective C-struct `AVFilterInOut` and `AVStream` mappings.*
