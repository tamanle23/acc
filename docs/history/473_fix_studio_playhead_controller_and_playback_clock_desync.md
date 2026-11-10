# 473. Fix Studio Playhead Controller and Playback Clock Desynchronization

## Problem
During timeline playback and interactive scrubbing in Studio, users experienced severe playhead jumping, desynchronization between audio and visual playheads, and backward frame snapbacks:
1. When pausing playback (or pressing Space), the playhead visibly jumped backward by 8 to 15 frames.
2. During continuous playback, the playhead occasionally glitched or stuttered backward instead of progressing smoothly across seconds.
3. Interactive manual scrubbing on the timeline ruler or dragging the playhead needle while playing caused "ghost seeks"—the playhead momentarily jumped to the scrubbed frame, but the ongoing clock pulled it right back to the previous playback position.
4. Pausing or mode-switching between `audio_master` and `monotonic_worker` in `DeterministicTimelineClock` caused clock discontinuity and frame resets.

---

## Root Causes

1. **Split-Brain State in `useShuttleEngine.ts`**:
   `useShuttleEngine` read its current frame from `options.currentFrame`. In `App.tsx`, `currentFrame` was a throttled reactive signal updated only every 250ms (~4Hz) via `PlayheadController.subscribeLowFrequency`. When pausing via `setSpeed(0)` or toggling play/pause, `useShuttleEngine` snapped playback to the stale throttled signal, causing an instant 8–15 frame backward jump.
2. **Harmful 250ms Circular Scrub Callback in Shuttle RAF Loop**:
   Inside `useShuttleEngine`'s RAF loop, `options.onScrub(discreteFrame)` was called every 250ms. This dispatched `handleScrub()` in `App.tsx`, which invoked `PlayheadController.seek(frame, true)` with an integer frame, clobbering sub-frame gliding and triggering unnecessary audio re-seeks mid-playback.
3. **Ghost Seeks via Concurrent Playback and Manual Scrubbing**:
   When the user clicked or scrubbed the timeline ruler during active playback, `PlayheadController.seek()` updated the needle, but `useShuttleEngine` and `DeterministicTimelineClock` continued advancing from their original temporal anchor. On the very next animation frame (16ms later), the clock overwritten the scrub position.
4. **$C^0$ Continuity Breach in `DeterministicTimelineClock.setSyncMode`**:
   `DeterministicTimelineClock.setSyncMode` switched between `audio_master` and `monotonic_worker` without resetting `accumulatedElapsedSec` or updating `playbackStartFrame`. When the browser suspended audio or switched sync modes, the elapsed time delta jumped or reset to 0, resetting the playhead to frame 0.
5. **Premature Integer Quantization in `DeterministicTimelineClock.tick`**:
   `tick()` calculated `deltaFrames = Math.round(audioElapsed * fps * speed)`. Rounding at each tick truncated fractional sub-frame increments, accumulating drift and causing jitter during low-speed shuttle or high-precision playback.
6. **Double-Driven DOM Needle in `Timeline.tsx`**:
   `Timeline.tsx` bound the needle element to `style={{ transform: ... }}` driven by the 250ms throttled signal while simultaneously attaching `PlayheadController.subscribeHighFrequency` direct DOM updates. Every 250ms, SolidJS re-evaluated the JSX style and snapped the needle backward.

---

## Plan & Solutions

1. **Single Source of Truth (SSOT) in `useShuttleEngine.ts`**:
   - Replaced `options.currentFrame` lookups with `PlayheadController.getInstance().getFrame()` to guarantee instantaneous, unthrottled frame reads at all times.
   - Refactored `setSpeed(0)` (pause) to freeze at the exact current playhead frame, call `PlayheadController.seek(currentFrame, true)`, and halt the audio engine cleanly.
   - Removed the redundant 250ms `options.onScrub(discreteFrame)` call from the shuttle RAF loop.
   - Refactored `stepFrame(delta)` to step single discrete frames relative to `PlayheadController.getFrame()`.
2. **Sub-Frame Precision & Seamless Re-Anchoring in `DeterministicTimelineClock.ts`**:
   - Updated `setSyncMode(mode)`: dynamically re-anchored `playbackStartFrame = this.currentFrame; accumulatedElapsedSec = 0; needsAudioReanchor = true;` to maintain strict $C^0$ continuity across sync modes.
   - Preserved full 64-bit floating-point precision on `this.currentFrame` during `tick()`, removing intermediate `Math.round()`.
   - Exposed `getFractionalFrame(): number` for high-frequency renderers and audio oscillators.
   - Maintained discrete integer outputs for backward-compatible `getState()`, `getFrame()`, and `getRationalTime()` via `Math.round()`.
3. **Interactive Scrub Auto-Pause in `App.tsx`**:
   - In `handleScrub(frame)`, checked if `PlayheadController.getInstance().getIsPlaying()` is true; if so, immediately commanded `shuttle?.setSpeed(0)` to halt playback and park cleanly on the scrubbed frame without fighting the clock.
4. **Decoupled DOM Playhead Needle in `Timeline.tsx`**:
   - Removed reactive JSX `style={{ transform: ... }}` from `playheadNeedleRef`.
   - Replaced with static initial inline style `style="transform: translate3d(208px, 0, 0);"`, granting exclusive control of needle translation to `PlayheadController.subscribeHighFrequency` at 60fps.

---

## Changes

- `apps/studio/src/lib/playhead/PlayheadController.ts`:
  - Added public `getFractionalFrame = (): number => this.currentFractionalFrame;` for sub-frame consumers.
- `apps/studio/src/lib/shuttle/useShuttleEngine.ts`:
  - Switched `getCurrentFrame` from `options.currentFrame` to `PlayheadController.getInstance().getFrame()`.
  - In `setSpeed`: paused frame anchored to `PlayheadController.getFrame()`, eliminating backward snap.
  - In `stepFrame`: stepped discrete frames relative to `PlayheadController.getFrame()`.
  - Removed circular `options.onScrub` invocation from the RAF loop.
- `packages/core-isomorphic/src/math/clock/DeterministicTimelineClock.ts`:
  - Added seamless re-anchoring in `setSyncMode` to prevent timeframe reset.
  - Maintained float precision on `this.currentFrame` in `tick()`.
  - Added `getFractionalFrame()` method.
- `apps/studio/src/App.tsx`:
  - Auto-paused active playback (`shuttle?.setSpeed(0)`) when manual scrub is initiated.
- `apps/studio/src/components/Timeline.tsx`:
  - Removed throttled JSX `style` binding from `playheadNeedleRef` in favor of high-frequency direct transform updates.
- `autogenerated-tests/studio_playhead_and_shuttle_clock_precision.test.ts`:
  - Created 7 formal unit test specifications covering sub-frame precision, sync mode $C^0$ continuity, fallback re-anchoring, high-frequency subscription, pause sync, and discrete frame stepping.
- `docs/iterations/master_implementation_plan_iteration_81.md`:
  - Consolidated master iteration plan covering all 8 mandatory sections.
- `apps/studio/doc/implementation_plan_67.md`:
  - Local companion plan for Studio.

---

## Verification

1. **Bun Test Verification**:
   ```bash
   bun test autogenerated-tests/studio_playhead_and_shuttle_clock_precision.test.ts autogenerated-tests/studio_texture_cache.test.ts autogenerated-tests/studio_three_audio_wiring.test.ts autogenerated-tests/studio_asset_cache_negative_cache_and_404_resilience.test.ts
   ```
   Output: **22 passed, 0 failed** across 4 test suites (234 expect assertions).
2. **Studio Production Build**:
   ```bash
   pnpm --filter @acc/studio build
   ```
   Output: **Built successfully in 23.62s** with 0 errors.
