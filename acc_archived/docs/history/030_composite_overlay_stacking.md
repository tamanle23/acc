# [029] Implement Stacking Logic for Composite Overlays

**1. Context & Problem Statement**:
The Combinatorial System generated multiple polyrhythmic layers (e.g., 3s, 5s, 7s) as separate `mp4`/`webm` files. We needed to integrate this seamlessly into the Main Engine (`src/renderer.ts`) so that when users define `"overlayComposite": "found_footage"` in their `story-config.json`, the engine automatically fetches/generates the overlay components and blends them correctly over the entire concatenated story video.

**2. Implementation Plan**:
- **JSON Schema & Types**: Added `overlayComposite` (string) to `StorySettings` in `src/types.ts` and `schema/story-config.schema.json`.
- **Config Resolver**: Ensured `resolveStorySettings` in `src/platforms.ts` properly passes down `overlayComposite`.
- **API Extraction**: Extracted `renderEffectLayer` from `overlay-effects-cli.ts` into a modular `src/overlay-effects/engine.ts` so it can be called seamlessly by the main FFmpeg renderer without spawning sub-processes.
- **FFmpeg Stacker (`src/overlay-effects/stacker.ts`)**: Built a robust `filter_complex` pipeline using `-stream_loop -1` to loop the overlay assets infinitely over the main concatenated video. Used `overlay=shortest=1` for WebM (alpha) and `blend=all_mode=screen:all_opacity=1:shortest=1` for MP4 (screen/luma) to ensure proper blending mode and length truncation.
- **Integration**: Placed the stacking logic at the final stage of `renderStoryVideo` inside `src/renderer.ts`.

**3. Changes Made**:
- `schema/story-config.schema.json`: [MODIFY] Added `overlayComposite` property.
- `src/types.ts`: [MODIFY] Added `overlayComposite` to `StorySettings`.
- `src/platforms.ts`: [MODIFY] Added pass-through for `overlayComposite`.
- `src/overlay-effects/engine.ts`: [NEW] API endpoint to render isolated layers.
- `src/overlay-effects/stacker.ts`: [NEW] Advanced polyrhythmic FFmpeg filter blending logic.
- `src/renderer.ts`: [MODIFY] Applied the `applyPolyrhythmicOverlays` step before finalizing the video render.
- `sample-story/story-config.json`: [MODIFY] Added `found_footage` composite test.

**4. Verification & Walkthrough**:
- `bun run cli.ts ./sample-story` was executed.
- System correctly concatenated the base slides first into a temp MP4.
- Dynamically triggered `Generating/Fetching 3 prime-duration layers...` for `found_footage`.
- FFmpeg efficiently stacked them using `blend` and `overlay` filters in one single pass and preserved the original audio track (`-c:a copy`).
- The entire process (rendering slides, interpolating, and compositing 3 stacked layers) executed remarkably fast (under 2 seconds).
