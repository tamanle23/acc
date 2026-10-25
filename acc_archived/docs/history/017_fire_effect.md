# [017] Implement Fire Overlay Effect

**1. Context & Problem Statement**:
The user noted that the `Action & Fire` group lacked an actual `fire` effect. They requested the addition of this effect to the architectural rule catalog and its implementation. The fire effect needed to leverage procedural generation to create realistic, seamless looping flames.

**2. Implementation Plan**:
- **Architecture Update**: Added `fire` to the `Action & Fire` catalog in `.agents/rules/overlay-effects-architecture.md` with variants `campfire_flames` and `wall_of_fire`.
- Create `src/overlay-effects/generators/fire.ts`.
- **fBm & Color Mapping**: Reused the vertically tileable Fractal Brownian Motion (fBm) noise algorithm developed for `smoke`. Instead of rendering greyscale clouds, mapped the normalized noise values (0.0 to 1.0) to a precomputed 256-color palette representing a fire gradient (Black -> Red -> Orange -> Yellow -> White).
- **Additive Blending**: Rendered 2 layers of fire noise scrolling upwards at different speeds. Blended them together using `globalCompositeOperation = 'screen'` to make the overlapping fire cores glow bright white/yellow, exactly like real fire.
- **Vertical Masking**: To ensure the flames didn't just look like a scrolling wallpaper, applied a `destination-in` linear gradient mask on a temporary canvas. This forces the flames to be thick and intense at the bottom of the screen and organically fade out into nothingness as they rise.

**3. Changes Made**:
- `.agents/rules/overlay-effects-architecture.md`: [MODIFY] Added `fire` effect rules.
- `src/overlay-effects/generators/fire.ts`: [NEW] Developed the fire generator supporting `campfire_flames` (bottom 30% of screen) and `wall_of_fire` (bottom 70% of screen).
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported `generateFireEffect`.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect fire --variant campfire_flames`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect fire --variant wall_of_fire`
- The rendered videos feature highly organic, swirling flames that seamlessly loop vertically, accurately simulating thermodynamics via fractal noise and additive blending.
