# Task 151: Regression Audit & Verification of Legacy Video Rendering Pipelines

## Problem Statement
Following the integration of voiceover audio mixing and active word-highlighted subtitles in the Universal Video IR rendering path (Task 150), verify that no legacy video rendering implementations, pipelines, or CLI dispatching contracts were broken:
1. Confirm zero regressions across all 6 content pipelines (`scraper`, `db`, `repurposing`, `story`, `rule-logic`, `ambient`).
2. Verify legacy multi-scene 3D Depth video rendering, NVENC zero-copy stream concatenation, background music mixing, and subtitle burn-in.
3. Fix any regressions in CLI argument handling and stage asynchronous resolution discovered during the audit.

## Findings & Root Cause Fixes
During full regression testing against legacy pipelines:
1. **Asynchronous Resolution in `StoryFolderResolutionStage.ts`:**
   - In `apps/cli/src/pipelines/04-generative-story/stages/StoryFolderResolutionStage.ts`, `resolveStoryFolder` was being called synchronously without `await`, resulting in `resolved.resolvedConfig` being undefined before accessing `.scenes`.
   - **Fix:** Added `await resolveStoryFolder(...)`.
2. **CLI Runner Argument Forwarding in `apps/cli/src/index.ts`:**
   - `run(customArgs?: string[])` was relying strictly on `process.argv.slice(2)` when called programmatically by test runners, causing interactive CLI prompts to trigger instead of executing the subcommands.
   - `runPipeline` was missing options forwarding (`outDir`, `duration`, etc.) and omitting the expected `executionResult` structure and `serve` subcommand handling.
   - **Fix:** Updated `run()` to accept optional `customArgs` and forwarded options in `runPipeline`.

## Changes Made
- `apps/cli/src/pipelines/04-generative-story/stages/StoryFolderResolutionStage.ts`: Added `await` to `resolveStoryFolder(...)`.
- `apps/cli/src/index.ts`:
  - Updated `run(customArgs?: string[])` signature.
  - Added CLI `serve` handler under `run()`.
  - Updated `runPipeline` to pass `cliOptions` (`outDir`, `duration`, `format`, `exporters`, `dryRun`) to `DefaultPipelineRegistry.execute` and return merged result.

## Verification & Test Results
1. **All 6 Content Pipelines (`all_6_pipelines_orchestrator.test.ts`):**
   - Pipeline 1 (Scraper): PASSED
   - Pipeline 2 (DB Templating): PASSED
   - Pipeline 3 (Repurposing): PASSED
   - Pipeline 4 (Generative Story): PASSED
   - Pipeline 5 (Rule & Math Logic): PASSED
   - Pipeline 6 (Ambient Stream): PASSED
2. **Unified CLI Suite (`phase6_unified_cli.test.ts`):**
   - 8/8 tests passed (run 2 DB, run 5 Math, run 6 Ambient, serve daemon, stream validation, help, list).
3. **Multi-scene 3D Depth & Video Rendering Stress Test (`stress_render.test.ts`):**
   - Executed 2 full iterations of 28 scenes on `sample-story` with 6 parallel workers:
     - 3D Depth effects (frame_breaker, volumetric_sandwich, depth_map_3d, parallax_25d, wigglegram, etc.): All 28 scenes completed without error.
     - Zero-copy stream concatenation via native `bun:ffi` `FFIConcatMuxer`: PASSED.
     - Background music mixer with dynamic volume: PASSED.
     - Total size: 37,210.7 KB, duration: 161.34s.
4. **Overall Suite Result:**
   - 42 tests across 4 suites passed in 104s with **0 failures**.
