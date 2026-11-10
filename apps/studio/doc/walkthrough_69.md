# Studio Walkthrough - Iteration 69: Single-Click Replay Audio Clock Leap Fix

## Summary
Resolved the issue where restarting playback from the timeline boundary required clicking Play twice.

## Key Changes
1. **`apps/studio/src/lib/shuttle/useShuttleEngine.ts`**:
   - Reordered `setSpeed(newSpeed)`: `PlayheadController.setIsPlaying(true)` and `WebAudioEngine.setShuttleSpeed(...)` execute before `setSpeedState(newSpeed)`.
   - Prevented `DeterministicTimelineClock` from reading stale `playbackStartAudioTime`.
2. **`apps/studio/src/lib/audio/WebAudioEngine.ts`**:
   - Reset `playbackStartAudioTime = 0` synchronously in `stopPlayback()`.
3. **`packages/core-isomorphic/src/math/clock/DeterministicTimelineClock.ts`**:
   - Added initial frame drift re-anchoring guard in `tick()` for `audio_master` mode.

## Verification
- Headless Edge test confirmed 4/4 transport inputs (Toolbar Play, Viewport Control Bar, Quick Transport, Spacebar) restart cleanly from frame 0 in exactly 1 click.
- Production build passed cleanly.
