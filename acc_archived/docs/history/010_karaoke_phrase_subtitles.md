# [010] Karaoke Phrase Subtitles

## 1. Context & Problem Statement
The user requested an improvement to how subtitles are rendered. Previously, the system used Whisper to extract word-level timestamps and rendered them exactly one word at a time on screen. The user wanted to group words into phrases (5-6 words) so the entire sentence is visible, while simultaneously highlighting the currently spoken word (e.g., glowing, scaling up, or changing color) similar to TikTok/Reels karaoke captions.

## 2. Implementation Plan
- **Chunking Logic**: Introduce a new function `groupCaptionsIntoPhrases` to group the raw Whisper word-level timestamps into arrays of up to N words, breaking early if punctuation or a long audio pause (>0.5s) is encountered.
- **Overlapping ASS Rendering**: Rewrite the ASS Dialogue generator to output multiple overlapping `Dialogue:` lines for the same phrase. Each line matches the exact duration of a specific spoken word and applies an inline ASS override tag to that word to make it stand out.
- **Highlight Presets**: Add dynamic highlight presets (`color`, `scale`, `scale-color`, `glow`) in `src/styles.ts` to allow users to customize the emphasis effect.
- **CLI Wizard**: Update `auto-config.ts` to prompt for these settings explicitly.

## 3. Changes Made
- **[MODIFY]** `src/types.ts`: Added `wordsPerPhrase`, `highlightPreset`, and `highlightColor` to `CaptionSettings`.
- **[MODIFY]** `src/styles.ts`: Added `getHighlightAssTag()` to return dynamic ASS override strings (`\c`, `\3c`, `\4c`, `\fscx`, `\fscy`) based on the selected preset and HEX color.
- **[MODIFY]** `src/subtitles.ts`: Implemented `groupCaptionsIntoPhrases` and completely refactored `generateAssContent` to support phrase-level overlapping rendering with inline tags (and `\r` resetting).
- **[MODIFY]** `auto-config.ts`: Added prompts for Karaoke settings (defaulting to 6 words and `scale-color` with Neon Yellow).
- **[MODIFY]** `sample-story/story-config.json`: Updated the sample to showcase the new fields.
- **[MODIFY]** `docs/STORY_CONFIG_SPEC.md`: Documented the new properties.

## 4. Verification & Walkthrough
Generated `story-config.json` via `auto-config.ts`. Verified the `.ass` intermediate file correctly generates chunked `Dialogue` blocks. The output video flawlessly highlights words one by one as they are spoken, perfectly synchronized without altering the core Whisper functionality.
