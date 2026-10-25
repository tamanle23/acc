# [018] Implement Retro Overlay Effects (Film Damage & VHS)

**1. Context & Problem Statement**:
The user requested the implementation of the `Retro` group. This includes `film_damage` (hairline scratches, film dirt) and `vhs` (tracking snow, tracking lines). These effects simulate old analog media degradation and require specific blending techniques (additive/screen) to look correct when overlaid on a video.

**2. Implementation Plan**:
- **`film_damage`**:
  - `hairline_scratches`: Pre-generated an array of vertical lines with random X-coordinates, durations, and start frames. Wrapped their age calculation to ensure they loop seamlessly. Added horizontal jitter during rendering.
  - `film_dirt`: Generated a 2D array of dirt particles (circles and bezier curve "hairs") per frame. Since dirt typically flashes for only exactly 1 frame on real film, this does not require complex wrap-around math to loop seamlessly.
- **`vhs`**:
  - `tracking_lines`: Drew horizontal bars scrolling downwards. To simulate VHS Chromatic Aberration (RGB displacement), drew a red bar offset to the left and a blue bar offset to the right of the central green/white bar, using `screen` composite operation to mix the colors perfectly.
  - `tracking_snow`: Pre-rendered a 200px-tall tile of black-and-white static noise. Scrolled this tile upwards, wrapping it at the screen edges, and added thick red and blue aberration lines at its borders to simulate tracking loss.

**3. Changes Made**:
- `src/overlay-effects/generators/film_damage.ts`: [NEW] Developed the film damage generator supporting `hairline_scratches` and `film_dirt`.
- `src/overlay-effects/generators/vhs.ts`: [NEW] Developed the VHS generator supporting `tracking_lines` and `tracking_snow`.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported both new generators.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect film_damage --variant hairline_scratches`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect film_damage --variant film_dirt`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect vhs --variant tracking_lines`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect vhs --variant tracking_snow`
- All 4 variants loop flawlessly and output the required MP4/JSON pairs.
