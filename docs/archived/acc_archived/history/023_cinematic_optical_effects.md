# [023] Implement Cinematic & Optical Effects (Bokeh & Lens Flare)

**1. Context & Problem Statement**:
The user requested the implementation of the `Cinematic & Optical` group. This group includes two staple effects for emotional storytelling and sci-fi/action editing: `bokeh` (out-of-focus drifting light circles) and `lens_flare` (anamorphic streaks and radial sun bursts). These effects require precise radial gradients and additive blending (`screen`).

**2. Implementation Plan**:
- Both effects are designed for MP4 overlay with a solid black background, meaning they rely on the user applying a 'Screen' blend mode in their NLE (Non-Linear Editor). Thus, internally, we draw with `globalCompositeOperation = 'screen'` against the black canvas to correctly sum the overlapping light values.
- **`bokeh`**:
  - `drifting_bokeh`: Generated 40 particles with warm cinematic colors (gold, pink, white). Particles drift using modulo wrapping on X and Y. *Fix*: To prevent visual "popping" when a large bokeh circle crosses the screen boundary and wraps, I drew the gradient twice (or up to 4 times for corners) across the boundary if it intercepts an edge.
  - `pulsing_bokeh`: Particles stay mostly stationary but wobble slightly, and their opacity pulses deeply based on a sine wave locked to the duration.
- **`lens_flare`**:
  - `anamorphic_streak`: Simulates JJ Abrams-style wide horizontal flares. Rendered a bright central radial core and stretched a multi-stop linear gradient horizontally to create the streak. Used sine waves to pulse the flare size and softly drift its position.
  - `sun_burst`: Simulated a classic radial glare by drawing 12 very thin, long triangles (rays) radiating from a core and rotating the entire group exactly 360 degrees over the video duration for a seamless loop.

**3. Changes Made**:
- `src/overlay-effects/generators/bokeh.ts`: [NEW] Developed the Bokeh generator.
- `src/overlay-effects/generators/lens_flare.ts`: [NEW] Developed the Lens Flare generator.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported both new generators.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect bokeh --variant drifting_bokeh`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect lens_flare --variant anamorphic_streak`
- Verified that both MP4 files loop perfectly. The boundary-wrapping logic for `drifting_bokeh` is flawless.
