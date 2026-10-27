# [053] FFmpegFilterGraph DAG Builder (Phase 2)

**1. Context & Problem Statement**: 
Prior to this phase, complex FFmpeg `filter_complex` operations (scene transitions via `xfade`/`acrossfade`, scene scaling/padding/subtitles, and background music auto-ducking via `sidechaincompress`) were constructed using raw, manual string concatenation. This was extremely fragile, difficult to read, and vulnerable to stream label collisions (such as `[v_out]` clashes), which caused sudden FFmpeg process crashes.

**2. Implementation Plan**: 
- Implement `FFmpegFilterGraph` in `src/core/FFmpegFilterGraph.ts` with collision-safe stream labeling, structured filter nodes, option serialization, and graph validation.
- Refactor `renderSingleScene` in `src/renderer.ts` to build video/audio filters via `FFmpegFilterGraph`.
- Refactor `concatenateWithTransitions` in `src/renderer.ts` to dynamically construct transition nodes.
- Refactor Background Music (BGM) mixing with auto-ducking to use `FFmpegFilterGraph`.
- Add Epic 6 to `docs/BACKLOG.md` to track migrating `overlay-effects-cli.ts` in subsequent work.
- Validate end-to-end rendering on `sample-story`.

**3. Changes Made**: 
- **`src/core/FFmpegFilterGraph.ts`**: Created object-oriented DAG builder for compiling collision-free FFmpeg filtergraphs.
- **`src/renderer.ts`**:
  - Imported `FFmpegFilterGraph`.
  - Upgraded `renderSingleScene` to build its filter complexes using `FFmpegFilterGraph`.
  - Upgraded `concatenateWithTransitions` to generate discrete `xfade` and `acrossfade` nodes with unique `[v_trans_i]` and `[a_trans_i]` streams.
  - Upgraded BGM mixing to generate `asplit`, `sidechaincompress`, and `amix` nodes via `FFmpegFilterGraph`.
- **`docs/BACKLOG.md`**: Added Epic 6 documenting future migration of `overlay-effects-cli.ts`.

**4. Verification & Walkthrough**: 
- Ran `bun run cli.ts ./sample-story`.
- All 4 scenes, transitions, and BGM auto-ducking rendered cleanly in 11.0 seconds with exit code 0.
- Video successfully written to `sample-story/output/Dinosaur_Story_17.mp4`.
