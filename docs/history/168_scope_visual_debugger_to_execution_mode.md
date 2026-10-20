# 168 - Scope Visual Debugger Toolbar and Breakpoints to Workflow Execution Mode

## Problem Statement
The Visual Debugger control bar (`Debugger (Pause / Step Over / Resume / Watch)`) and node breakpoint gutter dots were unconditionally visible in Visual DAG Studio during workflow design/authoring mode (`mode="full"` with no active `executionId`). In design mode, clicking debugger controls had no backend execution to control and caused confusing local mock state mutations.

## Solution Plan
1. **Scope Debugger Toolbar in `visual-dag-studio.tsx`**:
   - Conditionally render the Debugger Control Bar and the Floating Variable Watch Drawer strictly when `isExecutionMode = Boolean(isReadOnly && executionId)`.
   - In authoring/design mode, only display authoring tools (`Palette`, `Auto-Layout`, `Undo/Redo`, `Validate DAG`, `Import/Export IR`, `Save DAG`).
2. **Scope Breakpoint Dots in `dag-node.tsx`**:
   - Only render the interactive breakpoint gutter button on task nodes when debugging an active execution (`data.onToggleBreakpoint || data.hasBreakpoint`).
   - Clean canvas during workflow definition authoring.
3. **Update Test Suites**:
   - Add test case to `iteration13-studio.test.tsx` verifying that debugger buttons (`debugger-pause-btn`, `debugger-step-btn`, `debugger-resume-btn`, `debugger-variable-watch-btn`) are hidden in authoring mode and visible when `executionId` is provided.
   - Update mocks and providers in `visual-dag-studio-modes.test.tsx` and `dag-property-inspector.test.tsx` for query client coverage.
4. **Verification**:
   - `pnpm --filter @unipost/console exec vitest run src/features/metadata/components/studio/` passes 9/9 test files (39/39 tests).
   - `pnpm --filter @unipost/console exec tsc --noEmit` passes with 0 errors.

## Changes Made
- `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`: Wrapped debugger control bar, variable watch drawer, and breakpoint decorator in `isExecutionMode` checks.
- `apps/console/src/features/metadata/components/studio/dag-node.tsx`: Conditionally rendered breakpoint gutter button only if `data.onToggleBreakpoint || data.hasBreakpoint`.
- `apps/console/src/features/metadata/components/studio/iteration13-studio.test.tsx`: Added dual-mode debugger toolbar visibility assertion.
- `apps/console/src/features/metadata/components/studio/visual-dag-studio-modes.test.tsx`: Added mock endpoints for debugger mutations.
- `apps/console/src/features/metadata/components/studio/dag-property-inspector.test.tsx`: Wrapped component under `QueryClientProvider`.

## Verification
- Vitest: 39/39 tests passed across 9 test files.
- TypeScript compiler: 0 errors (`tsc --noEmit`).
