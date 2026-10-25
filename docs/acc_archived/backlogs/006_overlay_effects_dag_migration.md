# [006] Migrate Overlay Effects CLI & Complex Composites to FFmpegFilterGraph DAG

- **Status:** ✅ `[x] Completed`
- **Component:** Overlay Effects CLI / Core DAG
- **Created Date:** 2026-09-27
- **Completed Date:** 2026-10-02
- **Linked History:** [`053_ffmpeg_filtergraph_dag_phase_2.md`](../history/053_ffmpeg_filtergraph_dag_phase_2.md), [`116_mark_all_backlogs_completed.md`](../history/116_mark_all_backlogs_completed.md)

---

## 1. Context & Problem Statement
Following Phase 2 of the Architecture Vision (`docs/ARCHITECTURE_VISION.md`), the core video renderer adopted `FFmpegFilterGraph`. However, complex multi-layer stacking and procedural overlay generations in `overlay-effects-cli.ts` and `src/overlay-effects/pipeline.ts` still rely on legacy string-based filters and manual stream management.

## 2. Proposed Design & Implementation Ideas
- Migrate `src/overlay-effects/pipeline.ts` and combinatorial stacking engines in `overlay-effects-cli.ts` to `FFmpegFilterGraph`.
- Use DAG node-based routing for alpha-blending, chroma-keying, and composite layer stacking.
- Add static validation for composite stream graphs prior to running FFmpeg.

## 3. Acceptance Criteria & Implementation Results
- [x] `overlay-effects-cli.ts` and `pipeline.ts` fully use `FFmpegFilterGraph`.
- [x] No manual string interpolation for overlay filter chains.
- [x] Zero regressions in generated loop videos and companion `.json` metadata.
