# [048] Smart Router Integration for Sound Effects

## 1. Context & Problem Statement
Previously, the Sound Effects generator required the user (or the API consumer) to explicitly specify the generation engine (`ai`, `ffmpeg`, or `library`). This was a poor UX and broke the abstraction layer, as users shouldn't need to know the underlying technology. Furthermore, forcing AI for biological/physical sounds (like Foley or animals) resulted in unnatural audio, whereas Freesound excelled in those areas. The AI was better reserved for synthetic, cinematic, or sci-fi textures. We needed an intelligent routing system.

## 2. Implementation Plan
- **Analyze Optimal Engines:**
  - `ui`, `click`, `feedback`: `ffmpeg` (Fast, procedural math synth).
  - `fauna`, `diegetic`, `weather`, `urban`, `foley`: `library` (Real physical/biological recordings).
  - `cinematic`, `scifi`, `transition`, `custom`: `ai` (Creative, synthesized, non-existent textures).
- **Refactor `RegistryManager.ts`**: Remove engine selection from the constructor and implement `getGenerator(effect: string)` to instantiate and return the correct engine based on the rules.
- **Refactor `sound-effects-cli.ts`**: Remove `--engine` parameter. Consolidate all generated outputs into a `mixed/` output directory.
- **Provide Custom Prompt Tips**: As requested, add CLI helper tips for "Custom Prompt" mode to guide the user to write descriptive acoustic prompts.

## 3. Changes Made
- **[MODIFY] `src/sound-effects/core/Registry.ts`**: Implemented `[SmartRouter]` logic.
- **[MODIFY] `sound-effects-cli.ts`**: Removed engine dependencies and added `[PROMPT TIPS]` for interactive mode.
- **[MODIFY] `docs/history/README.md`**: Logged this history record.

## 4. Verification & Walkthrough
Ran multiple CLI tests:
1. `bun run sound-effects-cli.ts --effect foley --variant footsteps --sub-variant snow` -> Routed to `Library`.
2. `bun run sound-effects-cli.ts --effect ui --variant hover --sub-variant default` -> Routed to `FFmpeg Procedural`.
3. `bun run sound-effects-cli.ts --custom-prompt "A loud dramatic explosion"` -> Routed to `AI Fallback`.

The routing is entirely transparent, logging decisions like `[SmartRouter] Route 'foley' -> Library (Freesound)`. The user now interacts with a unified, intelligent acoustic layer.
