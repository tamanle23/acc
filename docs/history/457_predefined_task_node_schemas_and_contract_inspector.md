# 457: Predefined Task Node Schemas & Contract Inspector

## Problem Statement
In the workflow orchestration engine, Tasks serve as unaware Units of Work. However, users were unable to see predefined input and output schemas on node task definitions because:
1. `TaskDefinition.java` only declared `outputSchema` and `inputParameters`, omitting a first-class `inputSchema` property.
2. The Visual DAG Studio Property Inspector (`dag-property-inspector.tsx`) restricted its input requirements checklist to `matchedWorkerDescriptor?.inputSchema`. For all 20+ built-in system node types (`HTTP`, `LLM_CHAT_COMPLETE`, `SWITCH`, etc.) and unlinked `SIMPLE` nodes, `matchedWorkerDescriptor` was `undefined`, causing the inspector to return `null` and show zero expected parameters.
3. There was no public REST API serving canonical Draft 7 schemas for all 24 node types.
4. Sample workflows did not embed explicit node-level `inputSchema` and `outputSchema` on task definitions.

## Plan
1. **Extend `TaskDefinition` Model**:
   - Add `Map<String, Object> inputSchema` with builder support and backward-compatible constructors to [`TaskDefinition.java`](../../apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskDefinition.java).
   - Add pre-dispatch schema validation in [`SimpleTaskStrategy.java`](../../apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/SimpleTaskStrategy.java).
2. **Canonical Built-in Contract Catalog**:
   - Create [`TaskTypeContract.java`](../../apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/schema/TaskTypeContract.java) and [`BuiltInTaskContracts.java`](../../apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/schema/BuiltInTaskContracts.java) covering all 24 `TaskType` values.
   - Expose `GET /api/v1/tasks/contracts` and `GET /api/v1/tasks/contracts/{taskType}` via [`TaskContractController.java`](../../apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/TaskContractController.java).
3. **Seeder & Universal Sandbox Synchronization**:
   - Embed complete Draft 7 `inputSchema` and `outputSchema` on all task nodes in [`SandboxWorkflowSeeder.java`](../../apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/seed/SandboxWorkflowSeeder.java) and [`workflow-handler.ts`](../../packages/sandbox/src/handlers/workflow-handler.ts).
   - Add `/tasks/contracts` route handler in the universal sandbox simulator.
4. **Visual DAG Studio 2.0 Integration**:
   - Implement `resolveInputSchema`, `getInputParameters`, and `convertParamsToJsonSchema` in [`task-contract-registry.ts`](../../apps/console/src/features/workflows/components/studio/utils/contracts/task-contract-registry.ts).
   - Upgrade [`dag-property-inspector.tsx`](../../apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx) to render expected parameter type badges, auto-bind missing parameters, and display both Input and Output schemas.
   - Update [`dag-semantic-linter.ts`](../../apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.ts) and [`workflow-ir-converter.ts`](../../apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts).

## Changes

### 1. Backend Engine & Web Layer
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskDefinition.java`: Added `inputSchema`.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/SimpleTaskStrategy.java`: Added pre-dispatch input schema validation.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/schema/TaskTypeContract.java`: Defined canonical contract record.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/schema/BuiltInTaskContracts.java`: Defined Draft 7 schemas for all 24 `TaskType` values.
- `apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/TaskContractController.java`: Added `/api/v1/tasks/contracts` REST controller.
- `apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/seed/SandboxWorkflowSeeder.java`: Added node-level schemas to seeded workflows.

### 2. Universal Frontend Sandbox
- `packages/sandbox/src/handlers/workflow-handler.ts`: Added `/tasks/contracts` route handler and node schemas.

### 3. Visual DAG Studio 2.0
- `apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx`: Added `inputSchema` to `DagNodeData`.
- `apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts`: Round-tripped `inputSchema`.
- `apps/console/src/features/workflows/components/studio/utils/contracts/task-contract-registry.ts`: Added 4-tier `resolveInputSchema` and `getInputParameters`.
- `apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx`: Upgraded input contract checklist and dual schema viewers.
- `apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.ts`: Upgraded required input validation.

## Verification
- `BuiltInTaskContractsTest`: 2/2 passed.
- `SimpleTaskStrategyValidationTest`: 2/2 passed.
- `TaskContractControllerTest`: 2/2 passed.
- `SandboxWorkflowSeederTest`: 3/3 passed.
- `workflow-sandbox-handler.test.ts`: 12/12 passed (105 total in `@acc/sandbox`).
- `task-contract-registry.test.ts`: 9/9 passed.
- `dag-semantic-linter.test.ts`: 7/7 passed.
- `workflow-ir-converter.test.ts`: 21/21 passed.
- `dag-property-inspector.test.tsx`: 7/7 passed.
- `tsc --noEmit` across `@acc/console`: Zero errors.
