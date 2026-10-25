# [035] Implement Sound Effects CLI Utility

## 1. Context & Problem Statement
The user requested a standalone Sound Effects CLI, matching the architecture of the existing Overlay Effects Generator. The CLI needed to dynamically generate procedural sound effects, foley, diegetic ambience, UI clicks, and highly complex creature composites using FFmpeg audio filters.

## 2. Implementation Plan
- **Architecture Rule:** Created `.agents/rules/sound-effects-architecture.md` detailing the 3-layer frequency blueprint (Attack, Body, Sub) and the Fauna/Creature acoustic design matrix.
- **CLI Tool:** Created `sound-effects-cli.ts` taking arguments `--effect`, `--variant`, `--sub-variant`, `--composite`, and `--duration`.
- **Engine Layer:** Created `src/sound-effects/engine.ts` utilizing `fluent-ffmpeg` and complex filtergraphs (`amix`, `lowpass`, `asetrate`) to programmatically mix Base Variants into Sub-Variants.
- **Registry & Metadata:** Created `src/sound-effects/registry.ts`. The CLI outputs a `.json` companion file alongside every generated `.wav`.

## 3. Changes Made
- `[NEW] .agents/rules/sound-effects-architecture.md`
- `[NEW] sound-effects-cli.ts`
- `[NEW] src/sound-effects/engine.ts`
- `[NEW] src/sound-effects/registry.ts`
- `[MODIFY] docs/history/README.md` (Updated index)

## 4. Verification & Walkthrough
Tested standard generation:
`bun run sound-effects-cli.ts --effect foley --variant footsteps --sub-variant heavy_boots`

Tested combinatorial composite generation:
`bun run sound-effects-cli.ts --composite kaiju_roar`

Generated audio files successfully pair with companion `.json` metadata outlining exactly what FFmpeg filters were applied.
