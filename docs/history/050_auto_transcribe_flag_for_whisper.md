# [004] Auto Transcribe Flag for Whisper in auto-config

## 1. Context & Problem Statement
The `auto-config` CLI previously prompted the user every time to ask if they wanted to run Whisper AI for subtitle and timestamp extraction. The user requested to remove this interactive prompt and instead read an `autoTranscribe` boolean flag directly from `story-config.json`.

## 2. Implementation Plan
- Added `autoTranscribe?: boolean` to `CaptionSettings` in `src/types.ts`.
- Updated `schema/story-config.schema.json` to include the `autoTranscribe` property under `CaptionSettings`.
- Updated `docs/STORY_CONFIG_SPEC.md` to document the new property.
- Updated `auto-config.ts` to skip the interactive Whisper prompt and instead read the value of `prevConfig?.settings?.captions?.autoTranscribe !== false`. Added `autoTranscribe: doTranscribe` to the newly generated `story-config.json` to ensure persistence.
- Updated `sample-story/story-config.json` with the new property to ensure conformity to the 8-point synchronization protocol.

## 3. Changes Made
- `src/types.ts`: Added `autoTranscribe` to `CaptionSettings`.
- `schema/story-config.schema.json`: Documented `autoTranscribe` in the schema.
- `docs/STORY_CONFIG_SPEC.md`: Added `autoTranscribe` to the table in Section 4.
- `auto-config.ts`: Removed `askQuestion` for Whisper and substituted logic to use the config flag.
- `sample-story/story-config.json`: Provided a default `autoTranscribe: true`.

## 4. Verification & Walkthrough
- Ran `bun run cli.ts ./sample-story` to verify end-to-end rendering without regressions.
