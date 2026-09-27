# [036] Refactor Sound Effects CLI to Strategy Pattern

## 1. Context & Problem Statement
The user requested that the Sound Effects CLI strictly adhere to the Strategy Pattern, mimicking the overlay-effects maintainability standards. The initial implementation hardcoded the registry and rendering logic in a single engine file, which would lead to monolithic bloat as the extensive catalog of Foley, Cinematic, and Creature sounds scales.

## 2. Implementation Plan
- **Decoupled Architecture:** Created a `src/sound-effects/core/interfaces.ts` defining the `ISoundGenerator` contract.
- **Dedicated Strategy Classes:** Created `FoleyGenerator.ts`, `FaunaGenerator.ts`, and a `DefaultGenerator.ts` fallback inside `src/sound-effects/generators/`. Each class encapsulates its own FFmpeg synthesis logic.
- **Registry Dispatcher:** Refactored `RegistryManager` into `src/sound-effects/core/Registry.ts` to hold a map of `Effect -> ISoundGenerator`.
- **Engine Simplification:** Refactored `engine.ts` to simply call `registry.getGenerator(effect).generate(...)`.

## 3. Changes Made
- `[NEW] src/sound-effects/core/interfaces.ts`
- `[NEW] src/sound-effects/core/Registry.ts`
- `[NEW] src/sound-effects/generators/FoleyGenerator.ts`
- `[NEW] src/sound-effects/generators/FaunaGenerator.ts`
- `[NEW] src/sound-effects/generators/DefaultGenerator.ts`
- `[MODIFY] src/sound-effects/engine.ts` (Refactored to orchestrator)
- `[MODIFY] sound-effects-cli.ts` (Updated imports)
- `[DELETE] src/sound-effects/registry.ts` (Removed legacy hardcoded file)

## 4. Verification & Walkthrough
Tested standard generation:
`bun run sound-effects-cli.ts --effect foley --variant footsteps --sub-variant heavy_boots`
Verified output routes cleanly through `[FoleyGenerator]`.

Tested combinatorial composite generation:
`bun run sound-effects-cli.ts --composite kaiju_roar`
Verified output routes cleanly through `[FaunaGenerator]` multiple times to construct the layered mix.
