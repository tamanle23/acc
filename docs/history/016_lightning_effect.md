# [016] Implement Lightning Overlay Effect

**1. Context & Problem Statement**:
The user requested the implementation of the `lightning` effect to conclude the `Action & Fire` group. This effect requires 1-3 frame high-impact flashes, with two variants: `sheet_lightning` (sky flashes behind clouds) and `branching_lightning` (actual jagged bolts drawn across the screen).

**2. Implementation Plan**:
- Create `src/overlay-effects/generators/lightning.ts`.
- **Deterministic Events**: Pre-calculated specific frames in the loop (e.g., at 15%, 18%, and 65% of the total duration) where lightning strikes will occur. 
- **4-Frame Flash Animation**: Mapped the age of the strike (in frames) to a specific opacity sequence (1.0 -> 0.3 -> 0.8 -> 0.1 -> 0.0) to emulate the harsh, stuttering strobe effect of real lightning.
- **sheet_lightning**: Rendered massive radial gradients from the top edge, blending from intense white to purple, simulating atmospheric illumination.
- **branching_lightning**: Implemented a procedural random-walk algorithm (`generateBolt`) to draw a jagged line from top to bottom. Drew the stroke 3 times with varying thickness (15px purple, 30px dark purple, 5px solid white) to create a perfect outer glow without relying on expensive shadow filters.

**3. Changes Made**:
- `src/overlay-effects/generators/lightning.ts`: [NEW] Developed the lightning generator supporting `sheet_lightning` and `branching_lightning`.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported `generateLightningEffect`.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect lightning --variant sheet_lightning`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect lightning --variant branching_lightning`
- Verified that the generated videos contain sudden, intense strobes that loop flawlessly due to the deterministic event triggering.
