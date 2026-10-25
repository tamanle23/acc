# Implementation Plan 25: Phase 4 - Pure Isomorphic `@acc/ir`, Strategy-Decoupled Media Engine & Zero-Stub Registry

**Document ID:** `apps/studio/doc/implementation_plan_25.md`  
**Paired Walkthrough:** `apps/studio/doc/walkthrough_25.md`  
**Target Phase:** Phase 4 (Iteration 11 Modernization)  
**Status:** `[ ] Planned`  

---

## 1. Context & Architectural Re-evaluation

Following extensive recent enhancements across `@acc/ir` and `@acc/effect-engines` (unidirectional acyclic hierarchy `@acc/core` $\rightarrow$ `@acc/effect-engines` $\rightarrow$ `@acc/ir` $\rightarrow$ `apps/*`, canonical `IRCanvasCompositor`, and `DeterministicParticleField`):
1. **Entrypoint Duplication & Fake Stubs**:
   - `@acc/ir/client` (`packages/ir/src/client.ts`) and `packages/ir/src/plugins/clientRegistry.ts` maintain 10 dummy stubs (`createClientPluginStub`) for core plugins (`Depth3DPlugin`, `Camera3DPlugin`, `ColorGradingPlugin`, `BlendModePlugin`, etc.).
   - This violates `NO-STUBS-ORPHANED-CODE` and degrades the Studio preview fidelity.
2. **Leaked Server Imports**:
   - `packages/ir/src/plugins/vfx/Depth3DPlugin.ts` and `Camera3DPlugin.ts` leak static `import fs from 'fs'`.
   - `packages/ir/src/renderer/audio/UniversalAudioMixer.ts` leaks static `import fs from 'fs'` and `path` for `writeWavToDisk()`.
   - `packages/ir/src/prober/AssetMetadataProber.ts` leaks static `fs` into browser graphs.
3. **Unmanaged Concrete FFI in IR Renderer**:
   - `IRMasterRenderer.ts` directly instantiates `new FFIVideoDecoder(...)` from `@acc/core` instead of resolving video decoders through `MediaEngineRegistry` / `IMediaEngineStrategy`.
4. **Server Worker Isolation**:
   - `IRChunkWorkerPool` and `FFIChunkConcatMuxer` are currently exported directly from `@acc/ir/src/index.ts`, pulling native worker threads into root bundler graphs.

---

## 2. Key Decisions Aligned via Interview (/grill-me)

- **Comprehensive Isomorphic Unification**: Remove `@acc/ir/client` and all fake stubs; unify on `registerCoreModifierPlugins()` with 100% real plugin implementations.
- **Strict Removal of `./client` Export**: Completely purge `"./client"` from `packages/ir/package.json` and migrate all call sites in `apps/studio`, `packages/`, and tests to `@acc/ir`.
- **Unified Isomorphic Asset Ingestion**: Remove static `import fs from 'fs'` from `Depth3DPlugin` and `Camera3DPlugin`; resolve media inputs (paths, web URLs, Base64, and Blobs) through `CanvasAssetLoader` / `UniversalCanvasProvider`.
- **Strategy-Driven Video Decoding & Media Sink Contracts**:
  - Introduce `IVideoDecoder` contract in `@acc/core/src/media-engine/types.ts`.
  - Add `createVideoDecoder(filePath: string, targetWidth: number, targetHeight: number): IVideoDecoder` to `IMediaEngineStrategy`.
  - Implement `createVideoDecoder` in `BunFFIEngineStrategy` (wrapping `FFIVideoDecoder`).
  - Update `IRMasterRenderer.ts` to request decoders via `MediaEngineRegistry.get(engineType).createVideoDecoder(...)` without direct FFI imports.
- **Server Worker Entrypoint Isolation (`@acc/ir/server`)**:
  - Create `packages/ir/src/server.ts` exporting `IRChunkWorkerPool` and `FFIChunkConcatMuxer`.
  - Declare `"./server": "./src/server.ts"` in `packages/ir/package.json`.
  - Update CLI pipelines (`ir-render.ts`, `VideoEditPipelineOrchestrator.ts`) to import worker pool from `@acc/ir/server`.

---

## 3. Detailed Proposed Changes

### Step 1: `@acc/core` Media Engine Decoder Contract
- **`packages/core/src/media-engine/types.ts`**:
  - Define `IVideoDecoder`:
    ```typescript
    export interface DecodedVideoFrame {
      width: number;
      height: number;
      canvas: any;
      ctx: any;
    }
    export interface IVideoDecoder {
      open(): Promise<boolean>;
      close(): void;
      seek(targetFrame: number): Promise<boolean>;
      getNextFrame(): Promise<DecodedVideoFrame | null>;
      getFrame(frameIndex: number): Promise<DecodedVideoFrame | null>;
    }
    ```
  - Add `createVideoDecoder(filePath: string, targetWidth: number, targetHeight: number): IVideoDecoder` to `IMediaEngineStrategy`.
- **`packages/core/src/media-engine/strategies/BunFFIEngineStrategy.ts`**:
  - Implement `createVideoDecoder(filePath, targetWidth, targetHeight)` returning `new FFIVideoDecoder(filePath, targetWidth, targetHeight)`.
- **Fallback Strategies (`MediabunnyServerEngineStrategy`, `FluentFFmpegEngineStrategy`)**:
  - Provide corresponding/defensive `createVideoDecoder` implementations.

---

### Step 2: Purge Static `fs`/Node Imports & Decouple `IRMasterRenderer`
- **`packages/ir/src/plugins/vfx/Depth3DPlugin.ts`**:
  - Remove `import fs from 'fs'`.
  - Replace `fs.existsSync` with `CanvasAssetLoader.loadImage(params.imagePath)`.
- **`packages/ir/src/plugins/vfx/Camera3DPlugin.ts`**:
  - Remove `import fs from 'fs'`.
  - Use `CanvasAssetLoader.loadImage` for camera keyframe texture resolution.
- **`packages/ir/src/renderer/audio/UniversalAudioMixer.ts`**:
  - Remove top-level `import fs from 'fs'` and `import path from 'path'`.
  - In `writeWavToDisk()`, dynamically import `fs` and `path` (`const fs = await import('fs'); const path = await import('path');`) so browser bundlers never trace static Node fs calls.
- **`packages/ir/src/prober/AssetMetadataProber.ts`**:
  - Replace static `fs` with dynamic import or browser-safe probing guard.
- **`packages/ir/src/renderer/IRMasterRenderer.ts`**:
  - Remove `import { FFIVideoDecoder } from '@acc/core'`.
  - Resolve video decoders dynamically:
    ```typescript
    const strategy = MediaEngineRegistry.get(options.engine);
    const decoder = strategy.createVideoDecoder(resolvedPath, width, height);
    ```

---

### Step 3: Server Worker Isolation & Purge `@acc/ir/client`
- **`packages/ir/src/server.ts`**:
  - Create and export:
    ```typescript
    export * from './workers/IRChunkWorkerPool';
    export * from './workers/FFIChunkConcatMuxer';
    export * from './renderer/IRMasterRenderer';
    ```
- **`packages/ir/src/index.ts`**:
  - Remove `export * from './workers';`.
  - Root `@acc/ir` now exports 100% isomorphic modules (types, adapters, compilers, plugins, preview engine, audio mixer, canvas compositor).
- **`packages/ir/package.json`**:
  - Set exports:
    ```json
    "exports": {
      ".": "./src/index.ts",
      "./server": "./src/server.ts"
    }
    ```
  - Completely remove `"./client"`.
- **`packages/ir/src/plugins/clientRegistry.ts` & `packages/ir/src/client.ts`**:
  - Delete `clientRegistry.ts` (0 dummy stubs).
  - Delete `src/client.ts`.

---

### Step 4: Migrate Call Sites & Test Suites
- Update all call sites across `apps/studio` from `@acc/ir/client` to `@acc/ir`:
  - `apps/studio/src/main.tsx` (`registerCoreModifierPlugins`)
  - `apps/studio/src/App.tsx`
  - `apps/studio/src/components/LeftSidebar.tsx`
  - `apps/studio/src/components/Preview.tsx`
  - `apps/studio/src/components/RightSidebar.tsx`
  - `apps/studio/src/lib/audio/WebAudioEngine.ts`
  - `apps/studio/src/lib/ir/irState.ts`
  - `apps/studio/src/lib/library/sfxBank.ts`
- Update CLI pipelines (`ir-render.ts`, `VideoEditPipelineOrchestrator.ts`) to import `IRChunkWorkerPool` from `@acc/ir/server`.
- Update test files importing `@acc/ir/client` to import `@acc/ir`.

---

## 4. Verification Plan

1. **Automated Unit & Parity Tests**:
   - `bun test autogenerated-tests/ir_renderer_web_server_parity.test.ts`
   - `bun test autogenerated-tests/studio_phase3_timeline_enhancements.test.ts`
   - `bun test autogenerated-tests/studio_phase2_multi_tier_inspector.test.ts`
   - `bun test autogenerated-tests/systematic_editing_engine.test.ts`
2. **Production Bundle Verification**:
   - `bun run --cwd apps/studio build`
   - Verify build completes in <4s with **0 externalized `fs` / `path` warnings from `@acc/ir`**.
3. **History Archival & Git Commit**:
   - Log `docs/history/276_studio_phase4_isomorphic_ir_and_media_strategy_decoupling.md`.
   - Index in `docs/history/README.md`.
