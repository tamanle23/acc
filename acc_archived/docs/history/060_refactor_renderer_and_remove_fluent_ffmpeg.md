# [060] Refactor renderer.ts and Remove All fluent-ffmpeg Dependency Imports

## 1. Context & Problem Statement
Although `fluent-ffmpeg` was uninstalled from `package.json`, several files across the codebase (`src/renderer.ts`, `src/whisper.ts`, `src/core/BaseEffectEngine.ts`, `src/overlay-effects/pipeline.ts`, `src/overlay-effects/stacker.ts`) were still attempting to import `fluent-ffmpeg`. This caused `Cannot find package 'fluent-ffmpeg'` errors when running `bun run cli.ts`.

## 2. Implementation Plan
- **Create `src/core/FFmpegExecutor.ts`**:
  - Implements a native, zero-dependency FFmpeg CLI execution engine (`FFmpegCommand`) wrapped around `Bun.spawn` and `Bun.spawnSync`.
  - Implements `getMediaDuration` and `getMediaDurationSync` using native `ffprobe` spawn without external packages.
  - Supports fluent chaining (`.input()`, `.output()`, `.complexFilter()`, `.videoCodec()`, `.on('end')`, `.on('error')`).
- **Refactor Call Sites**:
  - `src/renderer.ts`: Replace `fluent-ffmpeg` import with `FFmpegExecutor`.
  - `src/whisper.ts`: Replace `fluent-ffmpeg` import and audio conversion with `FFmpegExecutor`.
  - `src/core/BaseEffectEngine.ts`: Replace `fluent-ffmpeg` import with `FFmpegExecutor`.
  - `src/overlay-effects/pipeline.ts`: Replace `fluent-ffmpeg` import with `FFmpegExecutor`.
  - `src/overlay-effects/stacker.ts`: Replace `fluent-ffmpeg` import with `FFmpegExecutor`.

## 3. Changes Made
- Created `src/core/FFmpegExecutor.ts`.
- Refactored `src/renderer.ts`, `src/whisper.ts`, `src/core/BaseEffectEngine.ts`, `src/overlay-effects/pipeline.ts`, `src/overlay-effects/stacker.ts`.
- Verified end-to-end rendering using `bun run cli.ts ./sample-story`.

## 4. Verification & Walkthrough
Ran `bun run cli.ts ./sample-story`:
- All 4 scenes rendered cleanly.
- Transitions and BGM mixed seamlessly.
- Output file created at `sample-story/output/Dinosaur_Story_20.mp4` in 3.0 seconds with zero `fluent-ffmpeg` dependency.
