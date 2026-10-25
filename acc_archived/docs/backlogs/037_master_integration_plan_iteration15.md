# Backlog 037: Master Integration Plan Iteration 15: Enterprise Production Quality, Studio Preview Smoothness, Zero-Stub Architecture, System Performance Tuning & Unified Time-Space State Machine

## Meta
- **ID**: `037`
- **Component**: Monorepo Core / Studio / Universal IR / Effect Engines / Native FFI
- **Created Date**: 2026-10-19
- **Status**: [x] Completed
- **Completed Date**: 2026-10-19
- **Linked History**: [`../history/282_master_integration_plan_iteration15_execution.md`](../history/282_master_integration_plan_iteration15_execution.md)

---

## 1. Context & Problem
An exhaustive audit across the ACC turborepo identified five core architectural vectors requiring deep modernization:
1. **Studio Player Preview & Playback**: Main-thread UI blocking, non-deterministic `requestAnimationFrame` + `performance.now()` clock drift, and synchronous 30s audio synthesis cuts.
2. **Stubs & Pseudo-Implementations**: `GenerativeBrollEngine`, `GenerativeAIFacade`, `VoiceIsolationCloningStrategy` producing dummy 1KB null-byte files; string-template facades for `CleanPlateEngine`, `SpatialVideoExporter`, `VoiceIsolationEngine`, and `ToneMappingEngine`; semantic inversion bug in `TextBasedEditingEngine`; and orphaned Conductor-named SAGA classes.
3. **System Performance & Memory Loops**: Per-frame `new DataView` allocations in `FFIVideoEncoder.ts`, canvas pixel readback GC churn, and lack of native buffer pooling.
4. **Disjoint Procedural VFX & Lack of Unified Time-Space Engine**: Pts coupled to browser `CanvasSpace` / `rAF` / unseeded `Math.random()`; GSAP running autonomous wall-clock tickers with scrub hysteresis.
5. **Enterprise Production Resilience**: Unrecoverable mid-render crashes, lack of chunk-level checkpointing, and unmanaged Python subprocess execution.

---

## 2. Proposed Design
1. **Studio Preview**:
   - `PreviewRenderWorker.ts` with `OffscreenCanvas` transfer.
   - `DeterministicTimelineClock.ts` slaved to hardware audio clock or discrete monotonic intervals with audio re-anchoring on seek.
   - `UniversalAudioStreamWorklet.ts` streaming continuous 128-sample PCM blocks with 5ms cosine cross-fades.
   - Decoded frame LRU ring buffer and dynamic scrub LOD (0.5x scaling at >3x shuttle speed).
2. **Stub Elimination & SAGA Decoupling**:
   - Purged all dummy null-byte files, connecting facades to valid MP4/WAV generation and content-hash caching in `~/.acc/`.
   - Enhanced `MatchmoveVisionFacade`, `EditingEngineFacade`, 3-tier `CleanPlateEngine`, `TextBasedEditingEngine` cut splitting, `ProxyAssetManager`, `SpatialVideoExporter`, `ToneMappingEngine`, and Demucs/RNNoise `VoiceIsolationEngine`.
   - Decoupled `ConductorSagaOrchestrator` to `SagaOrchestrator` with backward compatibility alias and wired into `PipelineRunner.runWithSaga` and `IRChunkWorkerPool`.
   - Defined vendor-neutral `IWorkflowOrchestrator` port.
3. **System Performance & Time-Space Engine**:
   - Pre-allocated `DataView` reuse and `NativeBufferPool` for native frame recycling in `@acc/core-native`.
   - Pure `DeterministicPtsEngine.ts` stripping DOM and `rAF`.
   - `StatelessHashNoise.ts` for 100% deterministic spatial hash noise.
   - `DeterministicGsapPtsProxy.ts` enforcing paused timelines and `lagSmoothing(0)` with proportional polygon resampling.
   - Unified `TimeSpaceStateMachine.ts` with multi-track boundary policies (`loop`, `pingpong`, `clamp`, `once`), discrete phase lifecycles (`enter`, `idle`, `exit`), and aspect-aware `SpaceContext` projection.
   - VideoIR schema sync adding `"time_space"` modifier and `TimeSpaceModifierPlugin.ts`.
4. **Enterprise Resilience & Checkpointing**:
   - `RenderCheckpointManager.ts` storing chunk metadata in `~/.acc/checkpoints/<jobId>.json` for crash resumption.
   - Supervised `PythonBackend.ts` with automated exponential backoff restart and health probing complying with `GLOBAL-STORAGE`.

---

## 3. Acceptance Criteria
- [x] Dedicated Web Worker preview via `OffscreenCanvas` with LRU decoded frame cache and dynamic scrub LOD.
- [x] Deterministic time-based frame engine slaved to hardware audio clock with auto-reanchoring on seek.
- [x] Streaming AudioWorklet master transport with continuous 128-sample blocks and smooth crossfades.
- [x] Elimination of all 1KB null-byte dummy files; production facades generating real MP4/WAV containers.
- [x] Decoupled SAGA orchestrator and vendor-neutral `IWorkflowOrchestrator` port with pipeline rollback wiring.
- [x] Zero-allocation native buffer pooling and cached DataView in `FFIVideoEncoder`.
- [x] Pure deterministic Pts math engine and stateless hash noise.
- [x] Deterministic GSAP-Pts proxy tweening core with paused timelines and `lagSmoothing(0)`.
- [x] Unified render-agnostic `TimeSpaceStateMachine` and `createTimeSpaceMachine` builder.
- [x] `TimeSpaceModifierPlugin` registered in VideoIR schema, validator, and compositors.
- [x] Persistent chunk-level checkpointing and resumption in `IRChunkWorkerPool`.
- [x] Resilient Python backend supervisor with restart backoff and health checks complying with `GLOBAL-STORAGE`.
- [x] All 15 automated test suites pass cleanly with 100% cryptographic byte parity and zero regressions.
