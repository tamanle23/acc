# [143] Mark `processAndRender` Experimental & Add Parity Backlog

## Problem
`VideoEditPipelineOrchestrator.processAndRender` is unused in production (only one test calls it), while `renderStoryVideo` is the real renderer. Intent and feature gaps were undocumented.

## Plan
1. Mark `processAndRender` `@experimental` via JSDoc.
2. Analyze features it provides that `renderStoryVideo` lacks.
3. Record as backlog item 013.

## Changes
- `apps/cli/src/pipelines/04-generative-story/VideoEditPipelineOrchestrator.ts`: JSDoc only; no behavior change.
- `docs/backlogs/013_ir_pipeline_feature_parity.md`: gap table, design, criteria.
- `docs/backlogs/README.md`, `docs/history/README.md`: index rows.

## Verification
Comment-only code change; no runtime impact. Gap analysis verified by grep within the orchestrator file.

## Walkthrough
Missing from `renderStoryVideo`: LUT/color grading, safe-zone margins, typography presets, J/L cut strategies, IR-configured ducking (partial), `VideoExporter`.

## Tasks
- [x] Mark experimental
- [x] Gap analysis
- [x] Backlog 013
