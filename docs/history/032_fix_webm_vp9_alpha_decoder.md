# [032] Fix WebM VP9 Alpha Decoding in Main FFmpeg Stacker

**1. Context & Problem Statement**:
In composite overlays (e.g. `found_footage`), the VHS tracking lines rendered on layer 1 were being completely hidden and overwritten by layer 2 (`camera_ui` WebM).
Investigation revealed:
- In FFmpeg, the native built-in `vp9` decoder does not decode the alpha plane (`yuva420p`) when demuxing WebM containers; it decodes it as opaque `yuv420p` with a solid black background.
- When `overlay` was applied, the WebM layer covered everything underneath it in black, obliterating earlier blended layers (like VHS tracking lines).

**2. Implementation Plan**:
- Update `src/overlay-effects/stacker.ts`: For any `.webm` input, explicitly prepend `-c:v libvpx-vp9` to the input options. The `libvpx-vp9` decoder correctly extracts and preserves the `yuva420p` alpha channel during stream overlay.
- Clean and re-render `Dinosaur_Story_5.mp4`.

**3. Changes Made**:
- `src/overlay-effects/stacker.ts`: [MODIFY] Added `-c:v libvpx-vp9` for all WebM inputs.

**4. Verification & Walkthrough**:
- Re-rendered story to `Dinosaur_Story_5.mp4`.
- Extracted frame image and confirmed:
  - Base story background and subtitle text.
  - Layer 1 (VHS tracking lines with RGB chromatic glitch bands).
  - Layer 2 (Camcorder UI with full alpha transparency).
  - Layer 3 (Film damage dirt particles).
  - All 3 layers are now perfectly visible and blended simultaneously.
