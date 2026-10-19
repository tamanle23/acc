# 154: Remove Visual DAG Studio from Metadata Schema Studio

## Problem Statement
The user requested to remove "Visual DAG Studio" from the Metadata feature screen (`/metadata`). Visual DAG orchestration belongs in its dedicated route (`/workflows` and `/workflow-executions`), avoiding confusion inside the schema and attribute model studio.

## Plan
1. In `apps/console/src/features/metadata/components/studio/visual-schema-studio.tsx`:
   - Remove `'conductor'` from `activeStudioTab` type union.
   - Remove `<TabsTrigger value="conductor">Visual DAG Studio</TabsTrigger>`.
   - Remove `VisualDagStudio` import and component rendering.
2. Verify with unit tests and TypeScript check.
3. Commit with Conventional Commits.

## Changes
- Modified `apps/console/src/features/metadata/components/studio/visual-schema-studio.tsx`:
  - Removed `VisualDagStudio` import, state value `'conductor'`, tab trigger button, and render branch.
- Created `apps/console/doc/walkthrough_129.md`.

## Verification
- `pnpm --filter @unipost/console exec vitest run src/features/metadata/components/studio/visual-schema-studio.test.tsx`: 8/8 tests pass.
- `pnpm --filter @unipost/console exec tsc --noEmit`: 0 errors.
