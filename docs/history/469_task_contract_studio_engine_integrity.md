# 469 - End-to-End Task Contract Design & Runtime Integrity

## Problem
Following the decoupling of Task Definitions and establishment of Backend SSOT (Iteration 74-77), critical gaps remained between design-time visual authoring and runtime execution:
1. In `dag-palette.tsx`, catalog mapping converted all task definitions into `SIMPLE` worker tasks, duplicating the 23 built-in platform nodes (`HTTP`, `LLM_CHAT_COMPLETE`, etc.).
2. In `dag-quick-insert-popover.tsx`, canvas quick-insert search omitted custom tenant tasks.
3. In `dag-property-inspector.tsx`, custom task nodes lacked dynamic schema-driven form controls, defaulting to raw JSON.
4. In `task-contract-registry.ts`, contract lookups were keyed only by `nodeData.taskType` ('SIMPLE'), causing custom tasks to miss preloaded schemas.
5. In `WorkflowEngineService.java`, worker output payloads were never validated against `outputSchema` on task completion, risking downstream corruption.

## Plan
1. **Studio Palette & Quick Insert**: Filter out `isBuiltIn` in `dag-palette.tsx`, inject custom tasks into `dag-quick-insert-popover.tsx`, and prevent React key collisions.
2. **Registry Name Resolution**: Enhance `task-contract-registry.ts` to inspect `nodeData.taskDefName || nodeData.taskType`.
3. **Dynamic Schema Inspector**: Render Task Definition metadata banner and dynamic schema property inputs with inline variable binding (`VariableBindingPopover`).
4. **Semantic Linter**: Verify custom task nodes missing required input parameters are flagged with `MISSING_REQUIRED_INPUT`.
5. **Backend Runtime Enforcement**: Validate worker output payloads against `outputSchema` in `WorkflowEngineService.java` and `SimpleTaskStrategy.java`, failing invalid tasks and quarantining to DLQ.
6. **Full Verification Suite**: Run Console Vitest tests, Backend Maven tests, and Sandbox tests.

## Changes
- **Console (`apps/console`)**:
  - `task-contract-registry.ts`: `getContract`, `resolveInputSchema`, `getInputParameters`, `resolveOutputSchema` inspect `nodeData.taskDefName || nodeData.taskType`.
  - `dag-palette.tsx`: Filter `!td.isBuiltIn && td.name !== 'SIMPLE' && !taskContractRegistry.isBuiltIn(td.name)` for catalog items.
  - `dag-quick-insert-popover.tsx`: Integrate `useTaskDefinitions()`, add `Custom` category filter, fix key collisions with `taskdef-${taskDefName}`.
  - `dag-property-inspector.tsx`: Add Task Definition banner, upgrade trigger, and dynamic schema parameters form with inline variable pickers.
  - Unit tests updated: `task-contract-registry.test.ts`, `dag-palette.test.tsx`, `dag-quick-insert-popover.test.tsx`, `dag-property-inspector.test.tsx`, `dag-semantic-linter.test.ts`.
- **Backend Workflow Engine (`apps/api/workflow-engine`)**:
  - `WorkflowEngineService.java`: Enforce `outputSchema` validation in `reportTaskResult(...)` before marking COMPLETED.
  - `SimpleTaskStrategy.java`: Defensively validate `existing.outputData()` against `taskDef.outputSchema()` when processing COMPLETED status.
  - `SimpleTaskStrategyValidationTest.java`: Added tests for output schema validation pass and fail scenarios.

## Verification
- Console Tests: 50/50 passed across all 7 test suites.
- Console TypeScript: `tsc --noEmit` passed with 0 errors.
- Backend Engine Tests: 100% passed with Java 21 / Maven 3.9.9.
- Sandbox Tests: 109/109 passed across 12 suites.

## Walkthrough
- Console Walkthrough: `apps/console/doc/walkthrough_175.md`
- Backend Walkthrough: `apps/api/doc/walkthrough_165.md`
- Master Plan: `docs/iterations/master_implementation_plan_iteration_79.md`

## Tasks
- [x] Deduplicate built-in nodes in `dag-palette.tsx`.
- [x] Integrate custom task definitions into `dag-quick-insert-popover.tsx`.
- [x] Resolve `taskDefName` in `task-contract-registry.ts`.
- [x] Build dynamic schema form in `dag-property-inspector.tsx`.
- [x] Enforce output schema validation in `WorkflowEngineService.java`.
- [x] Guard output schema in `SimpleTaskStrategy.java`.
- [x] Pass all automated test suites and typechecks.
