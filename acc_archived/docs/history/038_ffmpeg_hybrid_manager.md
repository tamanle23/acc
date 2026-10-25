# [038] FFmpeg Hybrid Manager & Auto-Downloader

**1. Context & Problem Statement**
The system relied on a global installation of FFmpeg, which caused high friction for new users (especially on Windows) leading to `ENOENT` crashes. NPM packages like `@ffmpeg-installer/ffmpeg` only provide static CPU builds, dropping support for hardware acceleration (NVENC/CUDA). A solution was needed to provide a "zero-config" experience while retaining full GPU capabilities.

**2. Implementation Plan**
Implement a Hybrid Fallback Manager:
- **Check System**: First try to use global `ffmpeg` to respect pro-user environments.
- **Check Local**: Check if `./bin/ffmpeg/ffmpeg.exe` exists from a previous auto-download.
- **Auto-Download (Windows)**: If neither exists, download the full GPU-enabled GPL build (`ffmpeg-master-latest-win64-gpl.zip`) directly from `BtbN/FFmpeg-Builds`, extract it, and route all paths to it.
- **Graceful Error (Unix)**: On macOS/Linux, fail elegantly with instructions (`brew install ffmpeg`), avoiding complex permission and architecture issues of binary auto-downloading on Unix.

**3. Changes Made**
- `[NEW] src/core/FFmpegManager.ts`: Implementation of the download, extraction, and path resolution logic.
- `[NEW] .agents/rules/ffmpeg-manager.md`: Added architectural rule enforcing `FFmpegManager` usage across the codebase.
- `[MODIFY] cli.ts`, `sound-effects-cli.ts`, `overlay-effects-cli.ts`: Injected `await FFmpegManager.prepare()` at bootstrap.
- `[MODIFY] src/renderer.ts`: Mapped `fluent-ffmpeg` to `FFmpegManager.getFFmpegPath()` and `.getFFprobePath()`.
- `[MODIFY] src/sound-effects/engine.ts`, `src/platforms.ts`: Refactored raw `child_process.exec` calls to use dynamically resolved, quoted paths.
- `[MODIFY] src/sound-effects/generators/*.ts`: Updated FFmpeg synthesis logic to use `FFmpegManager`.

**4. Verification & Walkthrough**
- Triggered `isSystemFFmpegAvailable()` false flag artificially.
- CLI outputs `[FFmpegManager] Automatically downloading full GPU-enabled Windows build...`.
- Verified HTTP download streaming, unzipping via `extract-zip`, and deep directory traversal to locate `ffmpeg.exe`.
- Rendering pipeline processes successfully leveraging the local binary.
