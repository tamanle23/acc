# [021] Implement Camera UI, Speed Lines & God Rays Effects

**1. Context & Problem Statement**:
The user requested the implementation of three highly sought-after groups from the expanded architecture catalog: `Motion Graphics & Camera UI` (transparent WebM overlays for viewfinder interfaces), `Anime & Manga Action` (transparent WebM speed lines), and `Volumetric Lighting` (MP4 additive light shafts).

**2. Implementation Plan**:
- **`camera_ui`**:
  - Implemented 3 variants: `camcorder_rec`, `cctv_security`, and `dslr_viewfinder`.
  - Used standard 2D vector primitives (`fillRect`, `strokeRect`, `fillText`) to draw battery indicators, crosshairs, and focus boxes.
  - Implemented a 1Hz 50% duty cycle blink (using modulo of `timeSec`) to flash the "REC" dot and focus indicators, ensuring a perfect loop over any duration.
- **`speed_lines`**:
  - Generated dynamic, sharp, high-contrast triangles (polygons) converging to the center (`radial_burst`) or horizontal lines rushing across the screen (`horizontal_rush`).
  - Lines are re-rolled every frame to create the aggressive, jittery anime/manga look.
- **`god_rays`**:
  - Simulated volumetric light shafts using thick polygons radiating from an off-screen light origin (top center).
  - Filled polygons with a vertical linear gradient (solid white/yellow fading to fully transparent at the bottom).
  - Used sine waves to individually modulate each ray's sway angle and pulse intensity, simulating dust movement and light diffraction. Blended with `screen` mode.

**3. Changes Made**:
- `src/overlay-effects/generators/camera_ui.ts`: [NEW] Developed the Camera UI generator.
- `src/overlay-effects/generators/speed_lines.ts`: [NEW] Developed the Anime Speed Lines generator.
- `src/overlay-effects/generators/god_rays.ts`: [NEW] Developed the Volumetric God Rays generator.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported all three new generators.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect camera_ui --variant camcorder_rec -t`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect speed_lines --variant radial_burst -t`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect god_rays --variant heavenly_glow`
- Verified that all videos loop perfectly and respect their respective background modes (WebM alpha transparency vs MP4 solid black).
