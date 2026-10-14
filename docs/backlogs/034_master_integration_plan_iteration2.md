# 034. Master Integration Plan (Iteration 2): Narrative Scripting, GPU Acceleration & Studio Preview

## Metadata
- **Status**: [ ] Planned
- **Component**: Core Architecture / Autoconfig / FFI GPU / UI Studio
- **Created Date**: 2026-10-14
- **Completed Date**: N/A
- **Linked History**: N/A

---

## Context & Problem
Following the full end-to-end validation of all 6 pipelines in Iteration 1 (`docs/history/189_end_to_end_validation_all_pipelines_and_audio_transcode_fix.md`) and the formal deprecation of external Conductor daemon abstractions (`docs/master_integration_plan_iteration_1.md`), the system requires a comprehensive plan to bridge creative narrative direction with hardware rendering speed and human-in-the-loop editing natively within `@acc/core`. 

Three major vectors are targeted:
1. **Option B (Narrative Scripting in `@acc/core/autoconfig`)**: The 48 visual styles need deterministic narrative pacing beats (Cold Hook, Friction/Stakes, Reset, Metaphor Build, Complication, Payoff) matching the 6 master scripting frameworks without any deprecated Conductor dependencies.
2. **Option C (GPU Acceleration Suite)**: CPU encoding bottlenecks under heavy temporal chunk concurrency (`-j 6+`) should be eliminated via pure `bun:ffi` hardware encoders (`h264_nvenc`, `h264_videotoolbox`, `h264_vaapi`) with software fallbacks.
3. **Option D (Dual-Engine Studio Preview)**: A web/UI timeline preview engine interacting directly with the `VideoIR` JSON AST enables interactive scrubbing, WebGL shader previews, and single-click deterministic export.

---

## Proposed Design
See the master specification in [`docs/master_integration_plan_iteration2.md`](../master_integration_plan_iteration2.md):
- **Pillar 1**: `IScriptingFrameworkStrategy` and 6 concrete strategies (`MysteryBoxExplainer`, `BreadcrumbTrailDigital`, `StakesAndEscalation`, `IntimateConfessional`, `HistoricalParallels`, `ContrarianThesis`) located natively under `packages/core/src/autoconfig/scripting/`.
- **Pillar 2**: `GPUEncoderResolver`, `GpuVideoEncodingStrategy`, zero-alloc FFI hardware buffers, and throughput benchmarking.
- **Pillar 3**: `StudioTimelineState`, JSON-Patch bidirectional synchronization, WebGL canvas shaders, and local Studio server CLI integration (`bun run cli.ts studio`).

---

## Acceptance Criteria
- [ ] **Pillar 1**: 6 Master Scripting Framework strategies implemented and registered in `ScriptingFrameworkRegistry`.
- [ ] **Pillar 1**: Automated A/V beat synchronization wired into `PipelineIRBuilder` and verified by tests.
- [ ] **Pillar 2**: Dynamic hardware encoder probing for NVENC, VideoToolbox, and VAAPI in `GPUEncoderResolver`.
- [ ] **Pillar 2**: Seamless zero-copy fallback to `libx264` when hardware encoders are absent.
- [ ] **Pillar 2**: Throughput benchmark demonstrating $\ge 2\times$ speedup on supported hardware with zero memory leaks.
- [ ] **Pillar 3**: Interactive Studio timeline state with JSON-Patch mutations over `VideoIRDocument`.
- [ ] **Pillar 3**: Real-time DOM/WebGL preview scrubbable at variable frame rates with deterministic export dispatch.
- [ ] **E2E QA**: All test suites pass cleanly (`bun test`) with zero regressions across Pipelines 1–6.
