---
trigger: always_on
---

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
- **BACKLOG-MANAGEMENT**: When deferring future tasks or completing existing backlog items:
  1. Create sequential 3-digit file in `docs/backlogs/XXX_<epic_name>.md` with Status (`[ ] Planned`), Component, Context, Design, Criteria.
  2. Sync master index table in `docs/backlogs/README.md`.
  3. When an implementation fulfills a backlog item, MUST mark status as `[x] Completed`, record completion date, link to History log (`docs/history/YYY_...md`), and check off criteria in both the item file and `docs/backlogs/README.md`. Detail: [.agents/rules/backlog-management.md](backlog-management.md).
