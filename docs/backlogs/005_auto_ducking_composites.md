# [005] Advanced Auto-Ducking Composites

- **Status:** ✅ `[x] Completed`
- **Component:** Audio Mixing / FFmpeg Filtergraph
- **Created Date:** 2026-09-27
- **Completed Date:** 2026-09-27
- **Linked History:** [`049_auto_ducking_composites.md`](../history/049_auto_ducking_composites.md), [`053_ffmpeg_filtergraph_dag_phase_2.md`](../history/053_ffmpeg_filtergraph_dag_phase_2.md)

---

## 1. Context & Problem Statement
When sound effects or narration voices overlap with background music (BGM), the audio mix becomes muddy. An automated sidechain compression system was needed to dynamically lower background audio levels when foreground speech occurs.

## 2. Proposed Design & Implementation Ideas
- Expand the audio rendering pipeline with FFmpeg `sidechaincompress` filter.
- Split main foreground audio via `asplit=2` to use one stream as the control signal for ducking the BGM.
- Re-mix ducked BGM with foreground audio using `amix`.

## 3. Acceptance Criteria & Implementation Results
- [x] Configurable `autoDucking: true` option in story settings BGM config.
- [x] Implemented `sidechaincompress` audio filtergraph in `src/renderer.ts`.
- [x] Upgraded to object-oriented DAG builder in `FFmpegFilterGraph.ts`.
- [x] Verified end-to-end rendering on `sample-story`.
