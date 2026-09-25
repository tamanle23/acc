# [014] Implement Embers Overlay Effect

**1. Context & Problem Statement**:
The user requested the implementation of the `embers` effect from the `Action & Fire` group. This effect simulates sparks flying up from a fire. It requires two variants: `campfire_sparks` (slower, gentle vertical drift) and `windy_sparks` (faster, aggressive horizontal drift). The sparks must flicker and seamlessly loop.

**2. Implementation Plan**:
- Create `src/overlay-effects/generators/embers.ts`.
- **Movement Math**: Sparks move with a negative Y speed (upwards). Used modulo arithmetic with positive wrapping `((y % height) + height) % height` to ensure they loop seamlessly when crossing the top boundary.
- **Flicker Math**: Applied a high-frequency sine wave to the opacity of each spark. The frequency `flickerFreq` was dynamically calculated per spark to ensure an integer number of full cycles (2 to 6 flickers) within the user-defined `duration`, guaranteeing a perfect seamless loop without sudden snapping.
- **Glow**: Added a secondary larger, semi-transparent circle behind the larger sparks (`z > 0.6`) to simulate an emissive glow.

**3. Changes Made**:
- `src/overlay-effects/generators/embers.ts`: [NEW] Developed the embers generator supporting `campfire_sparks` and `windy_sparks`.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported `generateEmbersEffect`.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect embers --variant campfire_sparks`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect embers --variant windy_sparks`
- Both videos seamlessly loop, showing glowing particles rising with mathematically synchronized flickers.
