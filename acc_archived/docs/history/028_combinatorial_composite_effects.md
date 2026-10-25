# [028] Implement Combinatorial System Architecture (Composites)

**1. Context & Problem Statement**:
The architecture documentation (`overlay-effects-architecture.md`) was expanded with a new directive: **Combinatorial System Architecture: Composite Effects Rule**. The goal is to generate thousands of unique visual outcomes by combining multiple prime-duration layers (Composite Effects) instead of creating hardcoded combined effects, saving codebase bloat.

**2. Implementation Plan**:
- Expanded `effects-registry.json` to include a new `composites` root object.
- Populated two initial composites: `haunted_forest` (fog, dust, film_damage) and `cyberpunk_alley` (rain, smoke, digital_glitch). Each layer strictly adheres to the Polyrhythmic Time rule (durations of 3, 5, 7, 11 seconds).
- Updated `src/core/Registry.ts` with `CompositeConfig` and `CompositeLayer` interfaces.
- Abstracted the `overlay-effects-cli.ts` rendering logic into a standalone `renderEffectLayer` function.
- Implemented the `--composite <name>` CLI argument, which fetches the layer array from the registry and utilizes `Promise.all()` to dynamically import and concurrently render all base layers associated with the composite.

**3. Changes Made**:
- `effects-registry.json`: [MODIFY] Appended `composites` object.
- `src/core/Registry.ts`: [MODIFY] Added Composite TypeScript interfaces.
- `overlay-effects-cli.ts`: [MODIFY] Refactored for combinatorial parallel execution.

**4. Verification**:
- Running `bun run overlay-effects-cli.ts --composite haunted_forest` correctly initializes three concurrent FFmpeg streams.
- Generated `fog_ground_mist_7s.mp4`, `dust_ambient_dust_5s.mp4`, and `film_damage_hairline_scratches_3s.mp4` perfectly as specified by the polyrhythmic design.
