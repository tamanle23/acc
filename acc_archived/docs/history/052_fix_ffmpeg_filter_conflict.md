# [052] Fix FFmpeg Filter Conflict (Error 234)

## 1. Context & Problem Statement
The user reported an error where the video rendering pipeline failed with `ffmpeg exited with code 234` and the output `Error opening output files: Invalid argument`.
Specifically, FFmpeg logs indicated: `Filtergraph 'scale=...' was specified for a stream fed from a complex filtergraph. Simple and complex filtering cannot be used together for the same stream.`
This occurred because the scene renderer in `src/renderer.ts` applied both `-filter_complex` (to handle scaling and audio mixing) and `-filter:v` (simple filtering) on the same input when processing scenes without specific audio filters but with video filters.

## 2. Implementation Plan
- Remove the redundant `command.videoFilters(videoFilters);` fallback block when `videoFilters` are already injected into the `complexFilter` block.
- Verify that `fluent-ffmpeg` output stream mapping (`-map [vout]`) accurately catches the output of the complex filter without needing the simple filter command.

## 3. Changes Made
### `src/renderer.ts`
- **[MODIFY]**: Removed the block:
  ```typescript
    if (audioFilters.length === 0 && videoFilters.length > 0) {
      command.videoFilters(videoFilters);
    }
  ```
  Since `videoFilters` are correctly passed into the `complexFilter` array earlier in the execution path, avoiding the conflicting `-filter:v` generation.

## 4. Verification & Walkthrough
- Re-tested the FFmpeg command behavior.
- Verified that `fluent-ffmpeg` properly splits array arguments and that the `[vout]` mapping accurately handles scenes using only video manipulation filters.
- Rendering commands no longer fail with exit code 234.
