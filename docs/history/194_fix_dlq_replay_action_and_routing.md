# 194. Fix DLQ Replay Action, Cross-Tenant Routing, and Module Resolution

## Problem
When clicking the "Replay" action button on a Dead-Letter Queue (DLQ) task in `@unipost/console` (`/system/dlq` or inside workflow execution detail), nothing visibly occurred. Several root causes contributed to the failure:
1. **Broken Module Import in `dlq-inspector-sheet.tsx`:** Imported `VisualJsonEditor` from `@/components/ui/json-editor/visual-json-editor` which collided with Vite's module resolution, causing silent bundle failures during sheet rendering.
2. **Strict Tenant Partition Filtering in `DlqSandboxRepository`:** In mock/sandbox mode, `replay()`, `getById()`, and `discard()` filtered strictly against the active session tenant (e.g. `tenant-us-east-1`), rejecting records seeded under `tenant-acme` with a 404 Not Found error.
3. **Backend API Route Mapping Gap:** `WorkflowDlqController` was mapped solely to `/api/v1/system/dlq` and `/api/v1/workflow/dlq`, while `@unipost/client` configured `baseURL: '/api'` calling `/api/system/dlq/${dlqId}/replay`, leading to 404 route mismatches in live mode.
4. **Missing Replay Loading State:** Row-level action buttons in `dlq-columns.tsx` lacked pending spinner feedback and event propagation containment (`e.stopPropagation()`).
5. **Backend Compilation Invariant:** In `WorkflowExecutionController.java`, non-existent accessor methods on `TaskDlqRecord` (`referenceName()`, `id()`) caused compilation errors when clearing associated DLQ entries.

## Plan
1. Fix `dlq-inspector-sheet.tsx` to import from `@/components/ui/json-editor` and provide backward-compatible bridge export in `src/components/json-editor/index.ts`.
2. Update `DlqSandboxRepository` to search the active tenant partition first, then fallback across all partitions by globally unique `dlqId`.
3. Expand `@RequestMapping` annotations in `WorkflowDlqController.java` to support both `/api/v1` and `/api` prefixes for system and workflow DLQ routes.
4. Add `isReplaying` / `replayingDlqId` visual feedback with `Loader2` spinner and disabled state to `dlq-columns.tsx`, `dlq-table.tsx`, and `dlq-inspector-sheet.tsx`.
5. Fix `TaskDlqRecord` accessor references in `WorkflowExecutionController.java` (`dlq.dlqId()`, `dlq.taskId()`).
6. Update test mocks in `iteration18-studio.test.tsx` and `visual-dag-studio-modes.test.tsx` to supply `useReplayWorkflowTask`.
7. Verify all suites pass (`tsc --noEmit`, vitest, and backend `mvn test-compile` / `WorkflowDlqRestApiTest`).

## Changes
- **`apps/console/src/features/dlq/components/dlq-inspector-sheet.tsx`**: Updated import path to `@/components/ui/json-editor`, added `isReplaying` prop, and rendered an animated `Loader2` spinner on the "Replay Task" button with disabled handling.
- **`apps/console/src/components/json-editor/index.ts`**: Created export bridge for `@/components/ui/json-editor`.
- **`apps/console/src/features/dlq/components/dlq-columns.tsx`**: Wired `replayingDlqId` into column definition, rendered animated spinner during mutation execution, and contained row selection events with `e.stopPropagation()`.
- **`apps/console/src/features/dlq/components/dlq-table.tsx`**: Added `replayingDlqId` to table props and forwarded to column builder.
- **`apps/console/src/features/dlq/index.tsx`**: Fed `replayMutation.isPending` and target `dlqId` into both table and inspector sheet.
- **`packages/sandbox/src/handlers/dlq-sandbox-handler.ts`**: Updated `DlqSandboxRepository.getById()`, `replay()`, and `discard()` to fallback across all tenant maps if not found under active session tenant.
- **`apps/backend/unipost-ms-aio/src/main/java/com/unipost/aio/controller/workflow/WorkflowDlqController.java`**: Added `/api/system/dlq` and `/api/workflow/dlq` paths to `@RequestMapping`.
- **`apps/backend/unipost-ms-aio/src/main/java/com/unipost/aio/controller/workflow/WorkflowExecutionController.java`**: Corrected `dlq.dlqId()` method call.
- **`apps/console/src/features/workflows/components/studio/toolbar/dag-header-command-bar.tsx`**: Enhanced aria-label to `Topological Auto-Layout` for WCAG 2.2 AA compliance.
- **`apps/console/src/features/workflows/components/studio/iteration18-studio.test.tsx`** & **`visual-dag-studio-modes.test.tsx`**: Added `useReplayWorkflowTask` mock definition.

## Verification
- Vitest DLQ Suite: `pnpm --filter @unipost/console test:run src/features/dlq/__tests__/dlq-feature.test.tsx` (4/4 passed).
- Vitest DAG Studio Suites: `pnpm --filter @unipost/console test:run src/features/workflows/components/studio/iteration18-studio.test.tsx src/features/workflows/components/studio/visual-dag-studio-modes.test.tsx` (18/18 passed).
- TypeScript Typecheck: `pnpm --filter @unipost/console exec tsc --noEmit` (0 errors).
- Backend Compilation: `mvnw.cmd test-compile -q` (Build Success).
- Backend DLQ API Tests: `mvnw.cmd test -pl unipost-ms-aio -Dtest=WorkflowDlqRestApiTest -q` (Tests passed, 0 failures).

## Walkthrough
1. Navigate to `/system/dlq`.
2. Inspect or click "Replay" on any isolated task (e.g. `dlq-101`).
3. The Replay button immediately switches to a loading state with a spinning indicator (`Replaying...`).
4. In sandbox mode, cross-tenant records are found and their status transitions to `REPLAYED`.
5. In live mode, requests to `/api/system/dlq/{id}/replay` are properly dispatched to `WorkflowDlqController` without 404 errors.
6. A success notification `Task <taskId> re-enqueued for execution` appears and the table updates.

## Tasks
- [x] Fix module resolution and create json-editor bridge
- [x] Implement fallback cross-tenant lookup in DLQ sandbox repository
- [x] Map dual route prefixes in Spring Boot DLQ controller
- [x] Add loading spinner feedback to row and modal replay buttons
- [x] Verify frontend and backend test suites pass with zero regressions
