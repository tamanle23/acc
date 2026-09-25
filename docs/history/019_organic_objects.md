# [019] Implement Organic Objects Overlay Effects (Leaves & Bubbles)

**1. Context & Problem Statement**:
The user requested the completion of the final architectural group: `Organic Objects`. This group requires rendering on a fully transparent background (`WebM` with Alpha) and includes two effects: `bubbles` (underwater and floating variants) and `leaves` (autumn breeze and sakura petals). These require sharp vector graphics and 3D geometric simulations rather than noise textures.

**2. Implementation Plan**:
- Both effects leverage `ctx.clearRect` to ensure the background remains fully transparent, triggering the CLI pipeline to output `WebM` files (VP9 + yuva420p) instead of `MP4`.
- **`bubbles`**:
  - Utilized a Canvas arc path to draw perfect circles with a solid white outline, a semi-transparent blueish core, and an inner white crescent to simulate specular highlights.
  - Simulated pressure-based growth: Bubbles scale up as they rise. To ensure the scale doesn't "pop" when modulo wrapping at the screen edges, the scale is driven by a sine wave frequency synchronized exactly to the video duration.
- **`leaves`**:
  - Implemented a 3D tumble/rotation simulation using pure 2D Canvas math. The leaf translates to its X/Y coordinate, rotates on the Z-axis, and is then mathematically scaled (squashed) on the X and Y axes using sine waves to simulate foreshortening as the leaf flips over.
  - Drew organic vector shapes using `bezierCurveTo` for sakura petals and `quadraticCurveTo` for autumn leaves.

**3. Changes Made**:
- `src/overlay-effects/generators/bubbles.ts`: [NEW] Developed the bubbles generator supporting `underwater_bubbles` and `floating_bubbles`.
- `src/overlay-effects/generators/leaves.ts`: [NEW] Developed the leaves generator supporting `autumn_breeze` and `sakura_petals`.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported both new generators.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect bubbles --variant floating_bubbles -t`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect leaves --variant sakura_petals -t`
- Verified that the resulting output files are `.webm` with alpha channel preserved and companion metadata JSON indicating `normal` blending on transparent BG.
