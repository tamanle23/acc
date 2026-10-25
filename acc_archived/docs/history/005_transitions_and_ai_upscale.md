# [005] Integrate Slide Transitions & AI Auto-Upscale

## 1. Context & Problem Statement
The user requested two major visual enhancements:
1. **AI Image Upscaling**: Automatically upscaling input images using AI models (Real-ESRGAN, UltraSharp) to improve clarity for 4K renders.
2. **Slide Transitions**: Adding visual transitions (fade, wipe, random) between slides.

Both of these requests posed architectural challenges:
- **Upscaling** requires spawning an external binary and downloading multi-platform models, ensuring cross-platform support.
- **Transitions** using FFmpeg (`xfade`) conflict with the `concat` demuxer. An `xfade` transition blends two videos, shrinking the total duration. If audio is crossfaded during a voiceover, the voices would overlap awkwardly.

## 2. Implementation Plan & Architectural Design

### A. Cross-Platform AI Upscaler Downloader (`src/upscaler.ts`)
Created a dedicated module that automatically detects the operating system (`process.platform`). If the `realesrgan-ncnn-vulkan` binary isn't present in `./bin/upscaler`, the system directs the user to download the correct OS-specific zip (Windows `.exe`, Linux, MacOS). Once available, it spawns the binary to process images in parallel *before* video generation.

### B. Audio Padding for Transitions (`audioBehavior: 'pad'`)
To prevent voiceovers from overlapping during an `xfade`, we implemented a `pad` behavior:
- Slide durations are padded with silence matching the transition `duration`.
- The `renderSingleSlide` intermediate video includes this padded silence.
- The `xfade` filtergraph consumes the padded silence, resulting in a smooth video crossfade while the voiceovers remain perfectly sequential.

### C. 6-Point Synchronization Checklist
- [x] **1. `src/types.ts`**: Added `TransitionSettings`, `UpscaleSettings`, and expanded both `StorySettings` (Global) and `SlideConfig` (Local Override).
- [x] **2. `docs/STORY_CONFIG_SPEC.md`**: Added Section 11 detailing the Upscale and Transition properties.
- [x] **3. Renderer (`src/renderer.ts`)**: Implemented pre-processing `upscaler` loop, modified NVENC intermediate flags, and built a dynamic `-filter_complex` for `xfade`.
- [x] **4. Auto-Config (`auto-config.ts`)**: Added interactive CLI prompts for Transitions and Upscaling.
- [x] **5. Sample Story (`sample-story/story-config.json`)**: Added a global fade transition and a local wipe override.
- [x] **6. `README.md`**: Updated Features and Cheat Sheet.

## 3. Changes Made
- **[NEW]** `.agents/rules/cross-platform.md`: Added rule enforcing cross-platform OS handling.
- **[NEW]** `src/upscaler.ts`: Handles invoking `realesrgan-ncnn-vulkan` natively.
- **[MODIFY]** `src/types.ts`: Added types for Transitions and Upscaling.
- **[MODIFY]** `src/renderer.ts`: Added `concatenateWithTransitions` to construct `xfade` complex filtergraphs.
- **[MODIFY]** `auto-config.ts`: Added CLI wizard inputs for the new features.
- **[MODIFY]** `cli.ts`: Passed `absoluteDir` down to the renderer context.
- **[MODIFY]** `docs/STORY_CONFIG_SPEC.md`, `README.md`, `sample-story/story-config.json`.

## 4. Verification & Walkthrough
- Transitions are successfully parsed.
- If disabled, rendering uses the high-speed `concat` demuxer as before.
- If enabled, the intermediate segments use `-cq 15` (high quality) and are then processed via a dynamically constructed `-filter_complex xfade` command.
- Overlaps correctly pad the audio, ensuring the storytelling voiceover doesn't collide during fades.
- Real-ESRGAN gracefully falls back with instructions if the binary is missing, respecting the cross-platform rule.
