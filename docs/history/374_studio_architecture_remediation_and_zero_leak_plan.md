# History Entry 374: Studio Architecture Remediation, Zero-Leak Memory Safety & State Integrity Plan

**Date:** 2026-10-29  
**Scope:** `@acc/studio`  
**Status:** Completed  
**Master Plan:** [master_implementation_plan_iteration_48.md](../iterations/master_implementation_plan_iteration_48.md)  
**App Plan:** [implementation_plan_42.md](../../apps/studio/doc/implementation_plan_42.md)  

---

## 1. Problem Statement
An in-depth systems audit across `apps/studio` revealed 7 critical architectural vulnerabilities:
1. `preview.worker.ts` destroys cached bitmaps (`existing.close()`) behind `PreviewFrameMemoryManager`'s back, producing invalid states on reverse scrubbing.
2. `PreviewWorkerCoordinator.reset()` abandons in-flight promises without rejecting them.
3. Multiple uncoordinated `window.addEventListener('keydown')` listeners collide on `Cmd+K` vs `KeyK`, `Delete`, and `Space`.
4. `IRStateManager.dispatch()` triggers un-awaited asynchronous compilations susceptible to out-of-order race conditions.
5. `useShuttleEngine.ts` throttles playhead ticks to 15 FPS before calling `StudioPlayheadController.seek()`, causing 60 FPS canvas and needle animation to stutter.
6. `TimelineCommandDispatcher` retains unbounded history, while commands execute 60+ synchronous `JSON.parse(JSON.stringify(doc))` deep clones.
7. `AudioAssetCache` retains uncompressed PCM in RAM instead of streaming via OPFS (`ContentCacheRegistry`), and duplicates `AudioContext`.

---

## 2. Implementation Plan
- **Phase 1 (P0):** Single ownership of `ImageBitmap` in `PreviewFrameMemoryManager`; create centralized `StudioKeyboardManager` with priority routing; reject in-flight promises on coordinator reset.
- **Phase 2 (P1):** Two-tier compilation guard (UI compiling state + awaitable `dispatch()` with sequential lock); decouple 60 FPS playhead needle/canvas from React; hash modifier parameters in coordinator task keys.
- **Phase 3 (P2):** Shared `AudioContext`; OPFS-first audio streaming via `ContentCacheRegistry`; OPFS file lock cleanup in `ClientExportOrchestrator`; eliminate `TimelineCommandDispatcher` and migrate commands to native `structuredClone`.
- **Phase 4 (P3):** Delete orphaned `ThumbnailLRUCache.ts` and clean dead `_isTransient` flags.

---

## 3. Changes Made
1. Created Master Implementation Plan: `docs/iterations/master_implementation_plan_iteration_48.md`
2. Created Companion Local App Plan: `apps/studio/doc/implementation_plan_42.md`
3. Documented complete systems audit: `docs/studio_code_antipattern_and_memory_leak_audit.md`
4. Registered history record in `docs/history/README.md`.

---

## 4. Verification
- Checked directory structure and numbering sequence (`Iteration 47`, `App Plan 42`, `History 374`).
- Validated all 8 required sections in the master implementation plan (Executive Summary, Trade-Offs, Mermaid Topology, Mathematical Specifications, Signatures, Phased Roadmap, Verification Matrix, Risk/Rollback Mitigations).
- Verified markdown link integrity across all documents.

---

## 5. Walkthrough & Tasks
- [x] Architectural Investigation & Systems Audit
- [x] Grill-me Design Alignment
- [x] Master Implementation Plan Iteration 47
- [x] Companion Local App Plan 42
- [x] History Registration
- [ ] Phase 1 Execution: Memory Ownership & Keyboard Consolidation
- [ ] Phase 2 Execution: Sequential Dispatch & 60 FPS Playhead
- [ ] Phase 3 Execution: Audio, OPFS & Command Unification
- [ ] Phase 4 Execution: Dead Code Removal & Hardening

---

## 6. Enhancement Opportunities
Future enhancements can explore WebGPU hardware blitting for modifier passes and Worker-offloaded audio synthesis via WebAssembly.
