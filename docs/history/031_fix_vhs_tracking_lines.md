# [031] Fix & Enhance VHS Tracking Lines Overlay

**1. Context & Problem Statement**:
In `found_footage` composite testing, the VHS tracking lines overlay was barely visible / not clearly appearing in the final composite mix.
Root causes identified:
- Canvas `ctx.globalCompositeOperation` was set to `'screen'` on frame 0 and not reset to `'source-over'` before clearing/filling `#000000` on subsequent frames.
- Tracking lines were drawn with very thin lines (2-4px) with low opacity on high-resolution 1080p canvas, causing them to wash out when blended.

**2. Implementation Plan**:
- Fix `ctx.globalCompositeOperation = 'source-over'` at the start of each render frame loop in `src/overlay-effects/generators/vhs.ts`.
- Enhance the `tracking_lines` variant with multi-slice distortion bands, high-contrast white cores, random noise slices, strong RGB chromatic aberration (red/cyan fringe), and tape head switching noise at the bottom edge.
- Clear cached overlay asset in `sample-story` and re-render.

**3. Changes Made**:
- `src/overlay-effects/generators/vhs.ts`: [MODIFY] Fixed composite reset & overhauled tracking lines visuals.

**4. Verification & Walkthrough**:
- Re-rendered `vhs_tracking_lines_3s.mp4`.
- Re-rendered full story `bun run cli.ts ./sample-story` outputting `Dinosaur_Story_4.mp4`.
- Extracted and verified frames containing prominent, high-contrast VHS distortion bands and head switching jitter.
