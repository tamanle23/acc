# [009] Output Refactoring & JSON Metadata Generation

## 1. Context & Problem Statement
The user requested an improvement to how output files are organized and named:
1. Output videos must be saved in an `output/` subdirectory within the story folder.
2. The `story-config.json` must support `name` and `description` root fields.
3. The rendered video filename should map to the `name` field.
4. Auto-increment naming strategy (e.g., `StoryName_1.mp4`, `StoryName_2.mp4`) must be applied to prevent overwriting previous renders.
5. A matching JSON metadata file must be generated alongside the video, capturing the `name`, `description`, platform, duration, and timestamp.

## 2. Implementation Plan
- Modify `src/types.ts` to include optional `name` and `description` fields on the `StoryConfig` interfaces.
- Modify `auto-config.ts` to interactively prompt the user for "Video Name" and "Description" (defaulting to the folder name).
- Modify `cli.ts` to intercept the output directory logic:
  - Create `output/` directory if missing.
  - Implement a `while (fs.existsSync(...))` loop to auto-increment a counter and determine the next available filename (`{baseName}_{counter}.mp4` and `{baseName}_{counter}.json`).
  - Write out the JSON metadata dump after `renderStoryVideo` succeeds.
- Update `docs/STORY_CONFIG_SPEC.md` and `sample-story/story-config.json` to showcase the new fields.

## 3. Changes Made
- **[MODIFY]** `src/types.ts`: Added `name` and `description` to `StoryConfig` and `ResolvedStoryConfig`.
- **[MODIFY]** `auto-config.ts`: Added CLI wizard prompts. Appended the parsed inputs to the exported `resultConfig`.
- **[MODIFY]** `cli.ts`: Moved output writing target from `absoluteDir` to `path.join(absoluteDir, 'output')`. Added regex sanitizer (`/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g`) for the output filename. Appended JSON dumping.
- **[MODIFY]** `docs/STORY_CONFIG_SPEC.md`
- **[MODIFY]** `sample-story/story-config.json`

## 4. Verification
Running `bun run cli.ts ./sample-story` creates `sample-story/output/Dinosaur_Story_1.mp4` and `sample-story/output/Dinosaur_Story_1.json`. Running it a second time successfully increments to `Dinosaur_Story_2`.
