# [007] Isolated Pipeline Architecture (Phase 3 - The Pipeline Orchestrator)

- **Status:** ⏳ `[ ] Planned`
- **Component:** Core Architecture / Pipeline Orchestrator
- **Created Date:** 2026-09-27
- **Completed Date:** N/A
- **Linked History:** N/A

---

## 1. Context & Problem Statement
Following Phase 1 (`AssetContext` & defensive fallbacks) and Phase 2 (`FFmpegFilterGraph` DAG builder) from `docs/ARCHITECTURE_VISION.md`, the final phase refactors the main rendering loop into a fully decoupled, extensible Pipeline Orchestrator to achieve complete workflow isolation.

## 2. Proposed Design & Implementation Ideas
- Implement `PipelineRunner` to orchestrate discrete processing stages (`Validation` -> `Asset Generation` -> `DAG Filtergraph Composition` -> `FFmpeg Execution` -> `Cleanup`).
- Register all pipeline features (TTS, AI Upscaling, 3D Depth, Overlays, Transitions, Audio Normalization, Background Music) as pluggable middleware implementing `IPlugin`.
- Sub-process Sandboxing (Actor Model): Run heavy AI tasks (such as Real-ESRGAN, Whisper alignment, VieNeu-TTS) in worker threads or isolated child processes with strict timeouts and resource limits.
- Implement **Dry-Run Mode**: Fast syntax and graph verification using `ffmpeg -f null -` on the generated command (validates in <1s before starting long renders).

## 3. Acceptance Criteria
- [ ] `renderStoryVideo` delegates execution to `PipelineRunner`.
- [ ] All features decoupled as discrete `IPlugin` middlewares.
- [ ] Sub-processes have watchdog timeouts and automatic fallbacks.
- [ ] Dry-run command validation flag supported in CLI (`--dry-run`).
