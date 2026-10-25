# Phase 1: FFmpegManager Shared Build Refactor

## 1. Goal
Implement Phase 1 of the Zero-Copy 4K implementation plan by refactoring `FFmpegManager` to download and manage FFmpeg **Shared Builds** instead of static builds. Shared builds contain `.dll` / `.so` libraries required for `bun:ffi` bindings.

## 2. Changes
- Modified `src/core/FFmpegManager.ts` to point to `os.homedir() + '.acc/bin/ffmpeg-shared'`.
- Changed download URL to BtbN's `ffmpeg-master-latest-win64-gpl-shared.zip`.
- Added logic to find the `bin` directory containing `.dll` libraries and exposed it via `FFmpegManager.getBinDir()`.
- Updated fallback paths for Linux/Mac to recommend `libavcodec-dev`, `libavformat-dev`, etc.

## 3. Impact
This is the foundational step for Phase 2. By having local access to `avcodec-*.dll`, `avformat-*.dll`, `swscale-*.dll`, and `avutil-*.dll`, the system is now prepared for `bun:ffi` struct bindings and direct native calls without relying on the CLI. The existing `fluent-ffmpeg` pipeline will continue functioning until it is entirely deprecated in Phase 5 because the shared build also includes `ffmpeg.exe` and `ffprobe.exe`.
