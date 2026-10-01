# [104] Sample Story All 3D Depth Modes Coverage

## Problem
The `sample-story/story-config.json` template previously only demonstrated a subset of 3D depth capabilities (`frame_breaker`, `volumetric_sandwich`, and `depth_map_3d`), leaving `parallax_25d` (2.5D multi-plane parallax with dolly zoom and foreground particles) and `wigglegram` (3D stereoscopic shake with chromatic aberration) uncovered in the reference showcase.

## Plan
1. **Expand `sample-story/story-config.json`**:
   - Add Scene 1: `frame_breaker` (Out-of-bounds popout with `polaroid` frame, 1.25x intensity, elevation drop shadow, and floating motion).
   - Add Scene 2: `volumetric_sandwich` (Layered 3D sandwich with custom `bannerText: "JURASSIC REALM"`, ambient floating dust, and vignette).
   - Add Scene 3: `depth_map_3d` (16-bit metric AI depth estimation via Depth Anything v2 + orbital 3D mesh displacement).
   - Add Scene 4: `parallax_25d` (2.5D multi-plane Parallax Ken Burns with `dolly_zoom` camera motion, depth blur, and floating foreground particles).
   - Add Scene 5: `wigglegram` (Stereoscopic 3D wigglegram oscillation with chromatic aberration).
   - Retain Scene 6: Video B-roll stock footage mixing with audio ducking.
2. **Verification**:
   - Execute `bun run cli.ts ./sample-story` end-to-end to verify 6-scene parallel rendering across all 5 distinct 3D Depth engines.

## Changes Made
- `sample-story/story-config.json`:
  - Configured 6 complete scenes exercising all 5 supported 3D depth engines (`frame_breaker`, `volumetric_sandwich`, `depth_map_3d`, `parallax_25d`, `wigglegram`) plus B-roll video overlay.

## Verification
- Verified end-to-end rendering: `bun run cli.ts ./sample-story` completed in 16.5s, successfully compiling 6 scenes into `sample-story/output/Dinosaur_Story_69.mp4`.
- Verified zero crashes or shader/memory issues across all parallel worker threads.
