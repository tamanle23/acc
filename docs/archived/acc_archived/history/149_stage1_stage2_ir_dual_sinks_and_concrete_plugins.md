# History 149: Stage 1 Adapter Registry, Concrete Plugins & Stage 2 Dual Sinks with Native bun:ffi FFIVideoEncoder

## Problem Statement
The Universal Video IR system required a complete, production-grade realization of the two-stage video creation pipeline:
1. **Stage 1 (Ingestion & Normalization):** Heterogeneous input configurations (legacy `story-config.json`, screenplay, database templates, etc.) must be dynamically adapted into schema-compliant Universal Video IR documents via an extensible strategy registry (`IRConfigAdapterRegistry`), adhering to the Open-Closed Principle (OCP).
2. **Stage 2 (Deterministic Dual-Target Execution):** The IR timeline must execute deterministically without wall-clock drift, targeting either:
   - **Headless Video Compilation:** Hardware-accelerated native encoding directly to physical `.mp4` using `bun:ffi` (`FFIVideoEncoderSink`) with zero child processes.
   - **Visual Video Editor Preview:** In-memory frame stream delivery with sub-16ms scrubbing latency for interactive frontend preview players (`PreviewCanvasSink`).
3. **Concrete Plugins & Layer Compositing:** Plugins previously stubbed or mock-only needed concrete implementations across all 4 lifecycle phases (Phase 2 Clip Space, Phase 3 Track Stream Space, Phase 4 Master Compositing, Phase 3 Audio Stream Space) as defined in Document 7.

## Key Changes Made

### 1. Stage 1 Strategy Pattern & Adapter Registry
- Created [`packages/ir/src/adapters/IConfigToIRAdapter.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/adapters/IConfigToIRAdapter.ts): Strategy interface specifying `canAdapt(config: unknown): boolean` and `adapt(config: TConfig, options?: AdapterOptions): VideoIRDocument`.
- Implemented [`packages/ir/src/adapters/IRConfigAdapterRegistry.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/adapters/IRConfigAdapterRegistry.ts): Singleton adapter registry with format autodetection, auto-registering `StoryConfigToUniversalIRAdapter` and facilitating new formats without touching core engine pipelines.

### 2. Concrete 4-Phase Lifecycle Modifier Plugins
- Created [`packages/ir/src/plugins/IVideoPluginStrategy.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/IVideoPluginStrategy.ts): Defines the unified 4-phase contract:
  - Phase 1: `preflightDAGResolution` (DAG compilation)
  - Phase 2: `renderClipSpace` (Sequence-level local frame rasterization)
  - Phase 3: `renderStreamSpace` (Track-level concatenated stream rasterization)
  - Phase 4: `renderMasterComposite` (Master canvas blend modes and post-processing)
- Upgraded concrete plugins:
  - [`Depth3DPlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/vfx/Depth3DPlugin.ts): Phase 2 Clip Space rendering with stylized card borders and breathing parallax.
  - [`TransitionCrossfadePlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/editorial/TransitionCrossfadePlugin.ts): Phase 2 Clip Space linear opacity crossfade calculation.
  - [`CanvasParticleOverlayPlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/overlay/CanvasParticleOverlayPlugin.ts): Phase 3 Track Stream Space procedural canvas particles (snow, rain, embers, dust).
  - [`BlendModePlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/overlay/BlendModePlugin.ts): Phase 4 Master Composite canvas `globalCompositeOperation` mapping.
  - [`DynamicDuckingPlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/sfx/DynamicDuckingPlugin.ts): Audio stream ducking attenuation.

### 3. Stage 2 Dual Sinks & IRMasterRenderer Integration
- Created [`packages/ir/src/renderer/sink/IIRFrameSink.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/renderer/sink/IIRFrameSink.ts): Abstract sink interface with `initialize`, `consumeFrame`, and `finalize`.
- Implemented [`packages/ir/src/renderer/sink/FFIVideoEncoderSink.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/renderer/sink/FFIVideoEncoderSink.ts): Hardware-accelerated `bun:ffi` video encoder sink utilizing `FFIVideoEncoder` to produce `.mp4` files.
- Implemented [`packages/ir/src/renderer/sink/PreviewCanvasSink.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/renderer/sink/PreviewCanvasSink.ts): In-memory frame sink with subscriber callbacks for interactive visual video editor scrubbers.
- Enhanced [`packages/ir/src/renderer/IRMasterRenderer.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/renderer/IRMasterRenderer.ts):
  - Preloads visual image assets declared in `timeline.assets`.
  - Blits visual layers, executes Phase 2 clip plugins, Phase 3 stream plugins, subtitles overlay, and passes raw pixel buffers directly to sinks while preserving `ZERO-ALLOC-FRAME-LOOP`.

### 4. CLI Execution & Verification
- Updated [`apps/cli/src/commands/ir-render.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/cli/src/commands/ir-render.ts) and [`apps/cli/src/index.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/cli/src/index.ts):
  - Added `-o` / `--output` flag handling.
  - Automatically provisions `FFIVideoEncoderSink` when `--output` is specified.
  - Ensures `FFmpegManager.prepare()` is called.
- Created formal end-to-end test suite: [`autogenerated-tests/video_ir_stage1_stage2_e2e.test.ts`](file:///c:/Users/Admin/workspace/git/acc/autogenerated-tests/video_ir_stage1_stage2_e2e.test.ts).

## Verification
- Ran all 6 Video IR test suites:
  ```bash
  bun test autogenerated-tests/video_ir_phase1_phase2.test.ts autogenerated-tests/video_ir_phase3_plugins.test.ts autogenerated-tests/video_ir_phase4_engine.test.ts autogenerated-tests/video_ir_phase5_parity.test.ts autogenerated-tests/video_ir_phase6_cli_scaling.test.ts autogenerated-tests/video_ir_stage1_stage2_e2e.test.ts
  ```
  Result: 24 tests passed across 6 files (0 fails).
- Verified physical CLI `.mp4` compilation:
  ```bash
  bun run apps/cli/src/index.ts ir-render --config ./sample-story/story-config.json --chunk-start 0 --chunk-end 15 --output ./sample-story/ir_cli_test.mp4
  ```
  Result: Successfully generated 0.15 MB playable MP4 video file with 15 encoded frames.
