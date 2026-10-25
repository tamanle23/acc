# History Entry 082: SAM 2 Segmentation Enhancement & Frame Breaker Refinement

## Problem
In `sample-story/story-config.json`, Scene 1 was configured with `"mode": "frame_breaker"` and `"frameStyle": "polaroid"`, but `"autoSegment": true` was missing. As a consequence:
1. `depthConfig.autoSegment` was falsy, preventing `IPCFacade.segmentSubject` from running.
2. In `frame-breaker.ts`, `subjectImg` was `null`, which activated a crude geometric fallback: `ctx.rect(0, 0, width, innerY + innerH * 0.5)`. This sliced a hard, rectangular block across the entire canvas width (including background trees, sky, and border) and scaled it over the polaroid card, resulting in an unnatural, blocky effect.
3. Concurrent workers in `renderer.ts` would compete to bootstrap the Python daemon simultaneously on port 50051 if not pre-warmed.

## Plan
1. Default `autoSegment` to `true` in `src/depth3d/index.ts` for pop-out 3D modes (`frame_breaker`, `volumetric_sandwich`) when not explicitly disabled.
2. Explicitly enable `"autoSegment": true` in `sample-story/story-config.json` for Scene 1 and Scene 2, and `"autoDepth": true` for Scene 3.
3. Replace the crude screen-wide rectangle in `frame-breaker.ts` with a smooth focal elliptical arch fallback for scenarios where AI segmentation is absent.
4. Add daemon pre-warming in `src/renderer.ts` and mutex locking (`bootstrapLock`) in `IPCFacade.ts` to cleanly serialize Python backend startup and avoid port collisions.
5. Verify with automated tests and full render of `sample-story`.

## Changes
- `sample-story/story-config.json`:
  - Added `"autoSegment": true` to Scene 1 and Scene 2, and `"autoDepth": true` to Scene 3.
- `src/depth3d/index.ts`:
  - Defaulted `shouldAutoSegment` to `true` for `frame_breaker` and `volumetric_sandwich`.
- `src/depth3d/frame-breaker.ts`:
  - Replaced `ctx.rect` with `ctx.ellipse` over the focal subject zone for fallback pop-out.
- `packages/core/src/ipc/IPCFacade.ts`:
  - Added static `bootstrapLock` to prevent concurrent daemon bootstrapping, and exposed `ensureDaemonRunning` on `IPCFacade`.
- `src/renderer.ts`:
  - Added pre-warming of AI subsystem prior to launching concurrent scene workers.

## Verification
1. `bun run cli.ts ./sample-story`:
   - Daemon pre-warmed cleanly at `127.0.0.1:50051`.
   - SAM 2 extracted 2.16MB alpha subject cutout for Scene 1 and Scene 2.
   - Clean pop-out render with subject only breaking the polaroid frame; no rectangular block artifacts.
   - Render completed in 11.5s with zero socket collisions.
2. Full 9-suite regression run:
   - 51/51 tests passed across 9 test files in 20.56s.

## Tasks
- [x] Default `autoSegment` to `true` for pop-out 3D Depth modes
- [x] Enable `autoSegment` in `sample-story/story-config.json`
- [x] Improve fallback clipping in `frame-breaker.ts`
- [x] Add mutex locking and pre-warming in `IPCFacade` and `renderer.ts`
- [x] Verify full test suite and clean story rendering
