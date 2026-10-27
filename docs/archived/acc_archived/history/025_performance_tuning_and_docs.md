# [025] Performance Tuning, Upscaler Config & Documentation

**1. Context & Problem Statement**:
- **Upscaler Flexibility**: User wanted the ability to automatically download custom NCNN models (like `4x-UltraSharp` and `RealESRGAN_x4plus_anime_6B`) directly via URLs rather than just packaging them manually.
- **Bottleneck in Rendering Pipeline**: Rendering slides with transitions was very slow due to FFmpeg generating intermediate `.mp4` slides with heavy compression (`preset medium`). Furthermore, launching multiple `realesrgan-ncnn-vulkan` instances concurrently choked the GPU's VRAM and stalled rendering.
- **Documentation**: Missing user-facing documentation for the `overlay-effects-cli.ts`.

**2. Implementation Plan**:
- **Model URL Registry**: Added `CUSTOM_MODEL_URLS` in `src/upscaler.ts` for dynamic downloading.
- **Fast Intermediate Rendering**: Introduced `fastIntermediate` configuration. When true, it forces `-preset ultrafast` and `-crf 12` during intermediate slide rendering.
- **GPU Throttling**: Hard-capped AI upscaling pool to `Math.min(2, activeConcurrency)` to prevent VRAM saturation.
- **Documentation Sync**: Fully documented the `overlay-effects-cli.ts` usage, parameters, and generated effect catalog into `docs/OVERLAY_EFFECTS_CLI.md`.

**3. Changes Made**:
- `src/types.ts`: Added `fastIntermediate?: boolean` to `StorySettings`.
- `src/renderer.ts`: Adjusted `outputOptions` for intermediate encodes and capped Upscaler concurrency.
- `src/upscaler.ts`: Refactored `checkAndDownloadUpscaler` to handle remote `.param` and `.bin` downloads.
- `schema/story-config.schema.json`: Added `fastIntermediate`.
- `auto-config.ts` & `sample-story/story-config.json`: Added `fastIntermediate: true` default.
- `docs/OVERLAY_EFFECTS_CLI.md`: [NEW] Detailed manual for overlay effects.
- `README.md`: Added link to the new documentation.

**4. Verification & Walkthrough**:
- Verified the CLI logic intercepts CPU-based H.264 rendering and overrides with `-preset ultrafast`.
- Verified `CUSTOM_MODEL_URLS` pointing to valid HuggingFace raw files for custom upscalers.
- Verified new Docs perfectly match `.agents/rules/overlay-effects-architecture.md` catalogs.
