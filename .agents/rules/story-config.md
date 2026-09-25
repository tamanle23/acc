---
trigger: always_on
description: Mandatory rule to execute full 6-point synchronization across Types, Specification Doc, Main CLI, Auto-Config, Sample Story, and README whenever story-config changes.
---

# Story-Config 7-Point Synchronization Rule

Whenever any modification, addition, or removal is made to the schema or interpretation of `story-config.json`, you **MUST** synchronize all 7 components:

1. **`src/types.ts`**: Strict types and docstrings for all options.
2. **`schema/story-config.schema.json`**: Update the strict JSON Schema definition with new properties, types, and enums.
3. **`docs/STORY_CONFIG_SPEC.md`**: Complete specification with property tables, presets, precedence rules, and JSON payloads.
4. **`cli.ts` & `src/renderer.ts` & `src/platforms.ts` & `src/styles.ts`**: Parse, resolve fallbacks, and render correctly via FFmpeg.
5. **`auto-config.ts`**: Inject latest defaults in `existingSettings` template for new folders.
6. **`sample-story/story-config.json`**: Update sample config and verify via `bun run cli.ts ./sample-story`.
7. **`README.md`**: Update quick references, cheat sheets, and documentation links.

### Backward Compatibility:
Always ensure non-breaking fallbacks exist for all new settings so previous config files continue to render without error.
