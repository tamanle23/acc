# Walkthrough - Iteration 171
# Predefined Task Node Input/Output Schemas Across Visual DAG Studio & Backend

## Overview
This iteration resolves the lack of predefined task node schemas across both the backend engine and Visual DAG Studio 2.0. Every node (both built-in system nodes and worker fleet tasks) now exposes its standard Draft 7 `inputSchema`, `outputSchema`, and parameter descriptors.

## Key Changes

### 1. Backend Engine & Schema Models
- [`TaskDefinition.java`](../../../../apps/api/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskDefinition.java):
  - Added first-class `Map<String, Object> inputSchema` property with builder support and backward-compatible constructors.
- [`SimpleTaskStrategy.java`](../../../../apps/api/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/SimpleTaskStrategy.java):
  - Added pre-dispatch gate validating `resolvedInput` against `taskDef.inputSchema()` before emitting `ScheduleTask`.
- [`TaskTypeContract.java`](../../../../apps/api/workflow-engine/src/main/java/com/acc/workflow/core/schema/TaskTypeContract.java) & [`BuiltInTaskContracts.java`](../../../../apps/api/workflow-engine/src/main/java/com/acc/workflow/core/schema/BuiltInTaskContracts.java):
  - Defined canonical Draft 7 schemas and parameter descriptors for all 24 `TaskType` values.
- [`TaskContractController.java`](../../../../apps/api/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/TaskContractController.java):
  - Exposed `/api/v1/tasks/contracts` and `/api/v1/tasks/contracts/{taskType}` returning unified built-in and worker contracts.
- [`SandboxWorkflowSeeder.java`](../../../../apps/api/acc-sandbox/src/main/java/com/acc/sandbox/seed/SandboxWorkflowSeeder.java):
  - Pre-warmed explicit node-level `inputSchema` and `outputSchema` on all tasks in `order-fulfillment-pipeline` and `order-fulfillment-v1`.

### 2. Universal Frontend Sandbox
- [`workflow-handler.ts`](../../../../packages/sandbox/src/handlers/workflow-handler.ts):
  - Synchronized default pipelines with node-level `inputSchema` and `outputSchema`.
  - Added mock route handler for `GET /api/v1/tasks/contracts`.

### 3. Visual DAG Studio 2.0
- [`task-contract-registry.ts`](../../../../apps/console/src/features/workflows/components/studio/utils/contracts/task-contract-registry.ts):
  - Added 4-tier `resolveInputSchema(nodeData, workerDescriptor)`.
  - Added `getInputParameters(nodeData, workerDescriptor)` returning expected parameters for all 24 node types.
  - Added `convertParamsToJsonSchema(params)` helper.
- [`dag-property-inspector.tsx`](../../../../apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx):
  - Replaced the worker-only input checklist with a unified Predefined Input Contract checklist showing expected parameter badges and "Auto-Bind Missing".
  - Passed `resolveInputSchema` to `VisualJsonEditor` for real-time validation.
  - Displayed both Predefined Input Contract Schema and Resolved Output Contract Schema under Outputs & Schema tab.
- [`dag-semantic-linter.ts`](../../../../apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.ts):
  - Pre-flight linting checks against `taskContractRegistry.getInputParameters`.
- [`workflow-ir-converter.ts`](../../../../apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts):
  - Round-trips `inputSchema` between `WorkflowTaskIR` and React Flow `DagNodeData`.

## Verification Results
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
