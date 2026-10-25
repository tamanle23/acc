# [020] Implement Liquid & Grunge Overlay Effects

**1. Context & Problem Statement**:
The user requested the addition of several brainstormed groups to the architecture catalog, and immediately requested the implementation of the `Liquid & Grunge` group. This group includes `rain_on_glass` (water drops on a lens/window) and `grunge_texture` (retro paper/halftone damage).

**2. Implementation Plan**:
- **`rain_on_glass`**:
  - Implemented a 2D volumetric water drop shader using pure Canvas drawing commands. Each drop features a dark outer shadow, a light inner body, and two white specular highlights (a crescent and a bounce light dot) to simulate liquid refraction.
  - `sliding_drops`: Used a modulo wrap on the Y-axis for drops sliding down, coupled with a horizontal sine wave to create a zigzag sliding path. The scale pulses slightly as it slides to simulate surface tension.
- **`grunge_texture`**:
  - Implemented a "stop-motion" pipeline: Rather than animating the texture every single frame (which looks too smooth like a digital filter), the generator pre-renders a small array of unique static textures and holds each texture for 4 frames (effectively running at 7.5 FPS).
  - `stop_motion_paper`: Generated warm translucent blocks, thousands of white scuff marks, and random scratch lines.
  - `flickering_halftone`: Generated a grid of dots (halftone) whose radius is modulated by noise, and the entire grid shifts randomly every few frames.

**3. Changes Made**:
- `.agents/rules/overlay-effects-architecture.md`: [MODIFY] Added 4 new groups to the catalog.
- `src/overlay-effects/generators/rain_on_glass.ts`: [NEW] Developed the rain on glass generator.
- `src/overlay-effects/generators/grunge_texture.ts`: [NEW] Developed the grunge texture stop-motion generator.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported both new generators.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect rain_on_glass --variant sliding_drops`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect grunge_texture --variant stop_motion_paper`
- Verified that both MP4 files loop perfectly. The grunge texture successfully reproduces a jittery 8fps stop-motion feel despite the video being 30fps.
