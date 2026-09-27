# Project Rules: Story Configuration & Documentation Protocol

## 🚨 Mandatory Rule: Complete 8-Point Synchronization on `story-config` Changes

Whenever ANY code change impacts the schema, properties, types, presets, platform defaults, or behavior of `story-config.json`, the following **8-Point Synchronization Protocol MUST be executed completely**:

1. **TypeScript Definitions (`src/types.ts`)**:
   - Strictly update and type all new interfaces, union types, optional properties, and docstrings.
2. **JSON Schema (`schema/story-config.schema.json`)**:
   - Update the strict JSON Schema definition with new properties, types, and enums.
3. **Specification Document (`docs/STORY_CONFIG_SPEC.md`)**:
   - Document all newly introduced or modified properties.
   - Specify types, default values, required vs optional flags, platform presets, and code examples.
4. **Dedicated Feature Guides (`docs/..._GUIDE.md`)**:
   - If the new feature introduces complex logic or new CLI workflows (like Video Scenes, 3D Depth, Sound Effects), create or update a dedicated `GUIDE.md` file in `docs/` to systemize the behavior.
5. **Core Renderer & Main CLI (`cli.ts`, `src/renderer.ts`, `src/styles.ts`, `src/platforms.ts`)**:
   - Ensure the Main CLI (`cli.ts`) and FFmpeg Renderer (`src/renderer.ts`) properly parse, validate, provide fallbacks, and execute the new settings across all formats/codecs.
6. **Auto-Config Tool (`auto-config.ts`)**:
   - Update `auto-config.ts` default template (`existingSettings`) so that freshly generated configuration files always include the latest properties, presets, and sensible defaults.
7. **Sample Story Config (`sample-story/story-config.json`)**:
   - Update `sample-story/story-config.json` to showcase the new feature/property in working order.
   - Run `bun run cli.ts ./sample-story` to verify end-to-end rendering without regressions.
8. **Project Readme (`README.md`)**:
   - Keep the Cheat Sheet, platform lists, and quick-start guides in `README.md` completely synchronized with the full specification and link any newly created guides.

---

### 🛡️ Backward Compatibility Guarantee:
- Any new property in `story-config.json` **MUST BE OPTIONAL** with non-breaking fallbacks.
- Older configuration files created in previous versions must continue to render successfully without errors or missing fields.

---

## 🚨 Mandatory Rule: Numbered History Archival of Implementation Plans & Walkthroughs

For **EVERY change** (from minor bug fixes, small tweaks, to major architectural enhancements):
1. **Numbered History File (`docs/history/XXX_<task_description>.md`)**:
   - Create a dedicated history record file in `docs/history/` with sequential 3-digit numbering (`001_...`, `002_...`, `003_...`).
   - Each history file MUST contain:
     - **Context & Problem Statement**: What was requested/broken.
     - **Implementation Plan**: Architectural decisions, touched files, 8-point checklist.
     - **Walkthrough & Verification**: Output logs, commands run, benchmark results.
2. **History Index (`docs/history/README.md`)**:
   - Keep `docs/history/README.md` updated with a summary table of all historic changes, timestamps, and target components.
3. **Git Commit Protocol**:
   - After successfully verifying the implementation and writing the history file, you MUST commit all changes to git.
   - Command: `git add .` followed by `git commit -m "[XXX] Task Title" -m "Brief description of the changes."` where `[XXX]` matches the 3-digit history ID.

---

## 🚨 Mandatory Rule: Overlay Effects CLI Modular Architecture

When developing the `overlay-effects-cli.ts` or its generators, you MUST follow the strict modular variant architecture and adhere to the effects catalog defined in `.agents/rules/overlay-effects-architecture.md`.

*   **Variants System**: Every effect must support variations (e.g., `--effect rain --variant drizzle`).
*   **Documentation Sync**: If a new effect or variant is created, the catalog in the rule file must be updated.

---

## ?? Mandatory Rule: Import Integrity & Refactoring Checks

When refactoring files or adding new function calls (especially in core modules like `src/renderer.ts`), you **MUST** ensure that all required module imports are present at the top of the file. 

1. **Verify Imports After Edit**: Never assume an import already exists if you introduce a new dependency or function call. 
2. **Preserve Existing Imports**: When doing partial replacements using tools like `replace_file_content` or `write_to_file`, ensure you do not accidentally trim or overwrite the import block.
3. **Compile/Type Check**: Before finishing a task, ensure the code is free of `ReferenceError`s by verifying that all called methods are explicitly imported in the file.

---

## ?? Mandatory Rule: Zero Regression & Workflow Stability

When fixing bugs, refactoring, or implementing new features, you **MUST NOT break existing working flows**. 

1. **Holistic Verification**: Do not blindly fix a localized error without considering the wider impact. Ensure that your changes do not inadvertently disable or break other existing features (e.g., removing a flag that another feature depends on).
2. **Preserve Existing Logic**: When using tools like `replace_file_content`, double-check that you are only modifying the intended logic. Do not accidentally delete surrounding code, fallbacks, or structural blocks.
3. **Test the Happy Path**: Always ensure the core pipeline still works end-to-end after your changes. Your code modifications must be strictly additive or safely refactored without causing side-effect regressions.
