# [061] Replace ffprobe Process Spawning with Native Bun FFI Duration Probe

## 1. Context & Problem Statement
The user inquired why `ffmpeg.exe`/`ffprobe.exe` processes were still being spawned during CLI execution. While `fluent-ffmpeg` was removed, `FFmpegExecutor.ts` still called `Bun.spawnSync([ffprobePath, ...])` to probe media durations.

## 2. Implementation Plan
- Implement `getMediaDurationFFI` in `src/core/ffmpeg-ffi/index.ts` using `avformat_open_input`, `avformat_find_stream_info`, and `avformat_close_input` from `libavformat` (`avformat-63.dll`).
- Replace `Bun.spawnSync` in `src/core/FFmpegExecutor.ts` with direct calls to `getMediaDurationFFI`.

## 3. Changes Made
- `src/core/ffmpeg-ffi/index.ts`: Added `getMediaDurationFFI(filePath)` extracting duration directly from memory offset 104 of `AVFormatContext` without launching any binary executable.
- `src/core/FFmpegExecutor.ts`: Replaced `Bun.spawnSync` in `getMediaDurationSync` with `getMediaDurationFFI`.

## 4. Verification & Walkthrough
Ran `bun run cli.ts ./sample-story`:
- Audio durations were probed in-memory via native FFI in microseconds.
- Rendering succeeded in 4.2s without invoking any `ffprobe.exe` process calls.
