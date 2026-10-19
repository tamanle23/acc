# Walkthrough 129: Remove Visual DAG Studio from Metadata Schema Studio

## Problem & Motivation
The user requested to remove "Visual DAG Studio" from the Metadata feature view. Visual DAG workflow design belongs in the dedicated `/workflows` and `/workflow-executions` domain routes, rather than being embedded inside the entity type Visual Schema Studio in Metadata (`/metadata`).

## Changes
- In [`apps/console/src/features/metadata/components/studio/visual-schema-studio.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/visual-schema-studio.tsx):
  - Removed unused import `VisualDagStudio`.
  - Removed `'conductor'` from `activeStudioTab` union state (`'canvas' | 'workflow' | 'composite'`).
  - Removed the `Visual DAG Studio` (`value="conductor"`) tab trigger button.
  - Removed the `activeStudioTab === 'conductor'` render branch.

## Verification
- Unit test suite passed: `pnpm --filter @unipost/console exec vitest run src/features/metadata/components/studio/visual-schema-studio.test.tsx` (8/8 tests pass).
- TypeScript check passed: `pnpm --filter @unipost/console exec tsc --noEmit` exited 0 with no errors.
