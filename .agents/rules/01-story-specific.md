# Project-Specific Rules: Visual Storytelling Generator

- **STORY-CONFIG-8POINT-SYNC**: On any `story-config.json` schema/property/behavior edit, MUST sync all 8 components:
  1. `src/types.ts`
  2. `schema/story-config.schema.json`
  3. `docs/STORY_CONFIG_SPEC.md`
  4. `docs/..._GUIDE.md`
  5. `cli.ts` / `src/renderer.ts` / `src/platforms.ts` / `src/styles.ts`
  6. `auto-config.ts`
  7. `sample-story/story-config.json` (verify via `bun run cli.ts ./sample-story`)
  8. `README.md`
- **HISTORY-GIT-ARCHIVAL**: For EVERY change:
  1. Create sequential 3-digit history log `docs/history/XXX_<task>.md` (Problem, Plan, Changes, Verification).
  2. Update index in `docs/history/README.md`.
  3. Run `git add .` and `git commit -m "[XXX] Task Title" -m "Brief summary"`.
- **FFMPEG-MANAGER**: MUST run `await FFmpegManager.prepare()` in entrypoints. Set paths via `setFfmpegPath`/`setFfprobePath` for `fluent-ffmpeg`. Quote binary path in shell calls.
- **GLOBAL-STORAGE**: MUST store global binaries/models in `path.join(os.homedir(), '.visual-storyteller')`. NEVER use `__dirname` or relative project paths for cached app assets.
- **STREAM-LABELS**: MUST use unique stream identifiers in FFmpeg `filter_complex` strings to prevent collisions.
