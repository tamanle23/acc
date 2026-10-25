# [039] Fauna Acoustic Translation Bridge (Vietnamese Onomatopoeia)

## 1. Context & Problem Statement
The user wanted to integrate an extensive catalog of Vietnamese animal onomatopoeias (từ tượng thanh) such as "gâu gâu", "ẳng ẳng", "ò ó o", and "ủn ỉn" into the Fauna sound generator. Directly passing these cultural strings into AI models like AudioLDM2 results in poor output because the models are heavily trained on English acoustic descriptions.

## 2. Implementation Plan
- **Acoustic Translation Bridge (`Fauna.ts`)**: Built a `FAUNA_DICTIONARY` mapping `variant` (e.g., `cho`) and `subVariant` (e.g., `ang_ang`) to precise English acoustic prompts (e.g., "High-pitched dog yelping in pain, canine crying, distress acoustic").
- **Backlog Tracking**: Initialized `docs/BACKLOG.md` to track two future epics:
  - Epic 1: Multi-language Cultural Subtitles (burning these onomatopoeias into video closed captions).
  - Epic 2: Story Config Enum Standardization (updating schema for autocomplete).
- **History Archival**: Logged this implementation in history.

## 3. Changes Made
- [NEW] `docs/BACKLOG.md`: Created to capture Epics 1 & 2.
- [MODIFY] `src/sound-effects/generators/ai/Fauna.ts`: Completely refactored the prompt generation logic to use the new `FAUNA_DICTIONARY` mapping. Added translations for 28+ cultural animal sounds.

## 4. Verification & Walkthrough
- Manually verified that running the AI engine with `--variant cho --sub-variant ang_ang` correctly resolves to the translated distress prompt before dispatching to the Python worker.
- Evaluated fallback logic for unknown variants (defaults to generic English construction).
