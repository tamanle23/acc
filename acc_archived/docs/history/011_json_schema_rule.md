# [011] JSON Schema & 7-Point Synchronization Rule

## 1. Context & Problem Statement
The user requested the creation of a JSON Schema to fully systematize the structure of `story-config.json`. Furthermore, they asked to update the project's foundational rules so that any future changes to the config would automatically require updating this JSON schema.

## 2. Implementation Plan
- **Schema Creation**: Create `schema/story-config.schema.json` compliant with JSON Schema Draft-07. Map all properties, Enums, and descriptions strictly against `src/types.ts` and `docs/STORY_CONFIG_SPEC.md` (including recent additions like `wordsPerPhrase` and `highlightPreset`).
- **Rule Upgrades**: Upgrade the existing "6-Point Synchronization Rule" to the "7-Point Synchronization Protocol" by injecting the JSON Schema update as mandatory Step 2.
- **Rule Enforcement**: Update both global rules (`AGENTS.md`) and local AI rules (`.agents/rules/story-config.md`).

## 3. Changes Made
- **[NEW]** `schema/story-config.schema.json`: Implemented the full, strict schema describing slides, transitions, upscaling, platform presets, rendering constraints, and karaoke captions.
- **[MODIFY]** `AGENTS.md`: Changed "6-Point" to "7-Point Synchronization Protocol" and added the JSON Schema requirement.
- **[MODIFY]** `.agents/rules/story-config.md`: Synced the rule definition to reflect 7 components.
- **[MODIFY]** `docs/history/README.md`: Added archival entry 011.

## 4. Verification & Walkthrough
The JSON schema correctly dictates object types and allowed enum values for keys like `platform`, `videoCodec`, `CaptionPreset`, `highlightPreset`, and `transitionType`. From now on, any agent modifying the config structure will be forced by `.agents/rules/story-config.md` to update this file to maintain codebase integrity.
