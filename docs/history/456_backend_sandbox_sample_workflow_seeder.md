# 456: Backend Sandbox Sample Workflow Seeder & End-to-End Flow Verification

## Problem Statement
Following the introduction of mandatory Draft 7 `inputSchema` and `outputSchema` enforcement and canonical boundary nodes (`START_WORKFLOW` and `END_WORKFLOW`), developer environments and sandbox runtimes required realistic, executable sample workflow definitions to test and demonstrate full end-to-end execution flows without requiring manual setup.

Furthermore, during end-to-end verification of strict schema pipelines, `EndWorkflowStrategy` inadvertently merged intermediate accumulated snapshot payload attributes into the final resolved output. When strict Draft 7 JSON schemas with `additionalProperties: false` were enforced on the terminal output node, these unmapped intermediate variables triggered validation failures, causing completed workflows to terminate with `Workflow output violates outputSchema`.

## Plan
1. **Develop `SandboxWorkflowSeeder`**:
   - Build a production-grade sample order fulfillment pipeline (`order-fulfillment-pipeline`) and multi-branch decision workflow (`order-fulfillment-v1`) adhering strictly to Draft 7 `inputSchema`, `outputSchema`, and canonical `workflow_start` / `workflow_end` boundaries.
   - Wire workers for `validateOrder`, `checkInventory`, `chargePayment`, and `expressCourier` via real in-process handlers.
   - Seed sample workflows across demonstration tenants (`tenant-acme`, `SYSTEM`, and `default`) upon application startup in `DEV` mode.
2. **Synchronize Universal Sandbox (`packages/sandbox`)**:
   - Update `packages/sandbox/src/handlers/workflow-handler.ts` definitions with exact schema parity, layout coordinates, and interface typing (`inputSchema`, `outputSchema`, `isPermanent`).
3. **Fix Output Isolation in `EndWorkflowStrategy`**:
   - Refactor `EndWorkflowStrategy` to prioritize explicit output parameter mappings defined on the terminal node. If `taskDef.inputParameters()` is specified, derive the output strictly from resolved parameters without polluting the payload with unmapped intermediate variables. Fall back to accumulated `outputPayload` only when explicit mappings are omitted.
4. **Comprehensive Verification**:
   - Unit tests for `SandboxWorkflowSeeder` and `SandboxDataPreWarmer`.
   - Unit tests for `EndWorkflowStrategyValidationTest` verifying schema validation and intermediate payload isolation.
   - Full end-to-end API integration test `testSandboxSampleWorkflowFullEndToEndExecution` in `WorkflowEngineRestApiTest`.
   - TypeScript checking and vitest execution in `@acc/sandbox`.

## Changes

### 1. Backend Sandbox
- `apps/backend/acc-sandbox/pom.xml`: Added dependency on `workflow-engine` with `provided` scope.
- `apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/seed/SandboxWorkflowSeeder.java`: Created seeder component building `order-fulfillment-pipeline` and `order-fulfillment-v1` definitions with Draft 7 schemas, variable bindings, and layout metadata.
- `apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/config/SandboxAutoConfiguration.java`: Added `SandboxWorkflowSeeder.class` to configuration `@Import`.
- `apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/seed/SandboxDataPreWarmer.java`: Injected `SandboxWorkflowSeeder` provider and triggered `seedSampleWorkflowsIfMissing()` during startup.

### 2. Workflow Engine Decider Strategy
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/EndWorkflowStrategy.java`:
  - Enforced strict output resolution: when `inputParameters` are specified on `END_WORKFLOW`, populate `resolvedOutput` strictly from resolving those mappings; fall back to `snapshot.outputPayload()` only if `inputParameters` is empty. Prevents accumulator pollution under `additionalProperties: false`.

### 3. Universal Frontend Sandbox
- `packages/sandbox/src/handlers/workflow-handler.ts`:
  - Extended `WorkflowDefinitionIR` interface with `inputSchema`, `outputSchema`, and `layoutMetadata` node flags.
  - Added `order-fulfillment-pipeline` and upgraded `order-fulfillment-v1` with Draft 7 schemas and canonical boundary nodes.

### 4. Tests
- `apps/backend/acc-sandbox/src/test/java/com/acc/sandbox/seed/SandboxWorkflowSeederTest.java`: Verified seeder builds valid definitions, registers across tenants in `DEV` mode, and skips in `TEST` mode.
- `apps/backend/acc-sandbox/src/test/java/com/acc/sandbox/seed/SandboxDataPreWarmerTest.java`: Updated pre-warmer test assertions with `SandboxWorkflowSeeder`.
- `apps/backend/workflow-engine/src/test/java/com/acc/workflow/core/decider/strategy/EndWorkflowStrategyValidationTest.java`: Added test asserting intermediate variables do not leak into terminal output when schema has `additionalProperties: false`.
- `apps/backend/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/WorkflowEngineRestApiTest.java`: Added `testSandboxSampleWorkflowFullEndToEndExecution()` covering definition retrieval, trigger, worker dispatch, step results, and terminal exit gate validation.

## Verification
- `SandboxWorkflowSeederTest` & `SandboxDataPreWarmerTest`: Passed (Exit code 0).
- `EndWorkflowStrategyValidationTest`: Passed (Exit code 0).
- `WorkflowEngineRestApiTest`: 4/4 passed (Exit code 0).
- `@acc/sandbox` Vitest Suite: 11 test files, 103 tests passed.
- `packages/sandbox` TypeScript check: Clean for workflow handlers.

## Walkthrough
1. On backend startup in `DEV` mode, `SandboxDataPreWarmer` triggers `SandboxWorkflowSeeder.seedSampleWorkflowsIfMissing()`.
2. `order-fulfillment-pipeline` is registered in `WorkflowDefinitionRegistry` for `tenant-acme`, `SYSTEM`, and `default`.
3. Client triggers `/api/v1/workflows/executions` with order parameters. Schema validator verifies Draft 7 contract.
4. Workers poll tasks via `/api/v1/tasks/poll` for each pipeline stage (`validateOrder` $\rightarrow$ `checkInventory` $\rightarrow$ `chargePayment` $\rightarrow$ `expressCourier`).
5. Upon courier completion, `EndWorkflowStrategy` evaluates `workflow_end`, mapping only declared terminal parameters (`orderId`, `reservationCode`, `transactionId`, `trackingNumber`, `fulfillmentStatus`), validates against `outputSchema`, and marks workflow `COMPLETED`.

## Tasks
- [x] Create `SandboxWorkflowSeeder` with sample order fulfillment pipeline.
- [x] Wire pre-warmer auto-seeding in `acc-sandbox`.
- [x] Fix terminal output resolution in `EndWorkflowStrategy`.
- [x] Synchronize universal sandbox definitions in `packages/sandbox`.
- [x] Validate end-to-end flow with automated REST API tests.
