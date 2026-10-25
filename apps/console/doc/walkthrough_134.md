# Walkthrough 134 — Iteration 13 Full-Stack Execution (Phases 1–7)

## Overview
Executed all 7 phases of `docs/integration_master_plan_iteration13.md` (`apps/console/doc/implementation_plan_134.md`) end-to-end with zero stubs and full backend-frontend alignment across `@acc/backend` (`workflow-engine`, `acc-fw`, `acc-ms-aio`), `@acc/worker` (`packages/worker`), `@acc/sandbox` (`packages/sandbox`), and `@acc/console`.

---

## Key Changes by Phase

### Phase 1: Re-Verify & Align Workstream 4 & Workstream 5 (Backend ↔ Frontend)
- **`WorkflowEngineService.applyCommands` (`workflow-engine`)**: Fixed `EngineCommand.UpdateTaskStatus` so that if a task execution does not yet exist in `PersistencePort` (such as `HUMAN` tasks transitioning directly to `WAITING_FOR_APPROVAL`, or `HTTP`/`SET_VARIABLE`/`SWITCH` tasks), it is upserted via `saveTaskExecution`.
- **`WorkflowApprovalsController` (`acc-ms-aio`)**: Exposed `/api/v1/workflows/approvals` and `/api/v1/workflow/approvals` (`GET` list with status filter & `POST /{id}/resolve`), wired to `WorkflowEngineService.resolveHumanApprovalTask`.
- **`EntityWorkflowTriggerDispatcher` (`acc-fw`)**: Enriched `APPROVAL_REQUESTED` SSE notification payload with `workflowKey`, `workflowName`, `taskReferenceName`, `assigneeRole`, `slaDeadline`, and `status`.
- **`FieldLevelSecuritySerializer` (`acc-fw`)**: Upgraded Jackson serializer to recursively mask sensitive keys inside nested `Map` (`jsonb`) and `List` structures and added an explicit `Set<String> schemaSensitiveFields` constructor overload.
- **`dlq-inspector-sheet.tsx` & `master-detail-row-inspector.tsx` (`@acc/console`)**: Embedded `VisualJsonEditor` for DLQ payload inspection/replay overrides and wired `usePreviewRestoreRecord` dry-run diff preview in the Master-Detail Row Inspector.

### Phase 2: Visual JSON Editor Advanced Capabilities (`@acc/console`)
- **Search & Filter Bar**: Added real-time key/value substring filtering in `VisualJsonEditor` with match count indicator and automatic ancestor path expansion in `JsonTreeNode`.
- **Array Reordering**: Added `Move Up` / `Move Down` controls for array elements in both `JsonTreeNode` and `JsonFormRow`.
- **Non-Blocking Inline JSON Schema Validation**: Implemented `validateAgainstJsonSchema` supporting `required`, `type`, `enum`, `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, and `additionalProperties`, surfacing inline node/row badges and toolbar validation status without blocking `onChange`.

### Phase 3: Core Workflow Engine Orchestration (`workflow-engine`)
- **`TaskSnapshot.workflowId`**: Added `@JsonProperty("workflowId")` helper method using `taskReferenceName` marker lookup so workflow IDs containing underscores are extracted cleanly.
- **`InMemoryPersistenceAdapter` & `PostgresJdbcPersistenceAdapter`**: Enhanced `pollTasks` to match either `taskType` OR `referenceName`, allowing `SIMPLE` task workers polling by specific task names (e.g., `"checkInventory"`) to claim tasks without breaking `TaskType` enum serialization.

### Phase 4: `SIMPLE` Task Worker Registration Protocol & 4-Layer SDK
- **Java Backend (`workflow-engine` & `acc-ms-aio`)**:
  - Created `@WorkflowTaskWorker` annotation, `TaskWorkerDescriptor` record, and `HttpWorkerTransportAdapter`.
  - Added `POST /api/v1/workflow/workers/register` and `GET /api/v1/workflow/workers/catalog` in `WorkerFleetController` & `WorkerRegistry`.
  - Created `SimpleTaskWorkerRegistrar` registering 7 built-in `@WorkflowTaskWorker` handlers (`checkInventory`, `expressCourier`, `groundPostal`, `cancelCourierBooking`, `validateOrder`, `chargePayment`, `publishCmsArticle`) with rich input/output JSON Schemas.
- **TypeScript Worker SDK (`@acc/worker`)**:
  - Upgraded `WorkflowWorkerHost` with startup `/register` capability handshake and periodic `/heartbeat`.
  - Fixed `TaskPoller.ts` `workflowId` extraction for underscore-containing IDs.
  - Added `packages/worker/src/runner.ts` (`createDefaultNodeWorkerHost`).
- **Unified Sandbox (`@acc/console` & `@acc/sandbox`)**:
  - Added `GET /v1/workflow/workers/catalog`, `POST /v1/workflow/workers/register`, and `useWorkerCatalog()` hook.

### Phase 5: Refine Workflow Designer (`VisualDagStudio` & `DagPropertyInspector`)
- **Bind to Registered Worker**: Added Worker Catalog selector in `dag-property-inspector.tsx` that auto-populates `taskReferenceName`, `domain`, `timeoutSeconds`, `inputParameters`, and binds the worker's `inputSchema` to `VisualJsonEditor`.
- **Upstream Variable Reference Pills**: Added clickable `${workflow.input.*}` and `${nodeRef.output.*}` pills in the Bindings tab.
- **Topological Auto-Layout & Undo/Redo**: Added Kahn-layered Auto-Layout (`LR`/`TB`) and `Cmd+Z` / `Cmd+Y` undo/redo stacks in `visual-dag-studio.tsx`.

### Phase 6: Deterministic AI-Assisted Schema Generation (`VisualSchemaStudio` & `acc-fw`)
- **Backend & Sandbox (`POST /api/v1/metadata/ai/synthesize-schema`)**: Implemented `AiSchemaSynthesizerService` and `AiSchemaSynthesizerController` in `acc-fw` plus matching Unified Sandbox handler in `metadata-sandbox-adapter.ts` using deterministic JSON AST inspection and 5 domain blueprints (`VENDOR_GOVERNANCE`, `ECOMMERCE_ORDER`, `FINTECH_PAYMENT`, `HEALTHCARE_PATIENT`, `SUPPLY_CHAIN_LOGISTICS`).
- **Frontend (`AiSchemaGeneratorModal`)**: Created `ai-schema-generator-modal.tsx` and wired the **"Generate with AI"** trigger button into `visual-schema-studio.tsx`.

### Phase 7: Workflow Visual Debugger (Engine & UI Breakpoints)
- **Engine & REST API (`workflow-engine`, `acc-ms-aio`, `@acc/sandbox`)**:
  - Added `PAUSED_AT_BREAKPOINT` to `WorkflowStatus` and `ExecutionState`.
  - Updated `PureDecider` to halt before scheduling a frontier task when its `taskReferenceName` is in `breakpoints`.
  - Added `POST /{id}/breakpoints`, `POST /{id}/pause`, `POST /{id}/resume`, `POST /{id}/step`, and `POST /{id}/tasks/{taskRef}/rerun`.
- **Visual Debugger UI (`dag-node.tsx`, `visual-dag-studio.tsx`, `task-telemetry-inspector.tsx`)**:
  - Added clickable red breakpoint gutter dots (`●`) and amber pulsing `PAUSED_AT_BREAKPOINT` halo on `DagWorkflowNodeComponent`.
  - Added Debugger Control Bar (`Pause`, `Step Over`, `Resume`, `Watch`) and floating Variable Watch drawer in `VisualDagStudio`.
  - Added **"Edit Input & Re-Run From Node"** in `TaskTelemetryInspector`.

---

## Verification Summary
- `node mvnw.cjs test -pl workflow-engine -q`: **PASS (0 failures)**
- `node mvnw.cjs test -pl acc-fw "-Dtest=FieldLevelSecuritySerializerTest,AiSchemaSynthesizerServiceTest" -q`: **PASS (0 failures)**
- `node mvnw.cjs test -pl acc-ms-aio "-Dtest=WorkflowIteration13ControllersTest,WorkerFleetControllerTest" "-Djacoco.skip=true" -q`: **PASS (0 failures)**
- `pnpm --filter @acc/worker test`: **PASS (4 test files, 7 tests)**
- `pnpm --filter @acc/sandbox test`: **PASS (9 test files, 94 tests)**
- `pnpm --filter @acc/console exec vitest run src/components/ui/json-editor/visual-json-editor.test.tsx src/features/metadata/components/studio/iteration13-studio.test.tsx`: **PASS (2 test files, 6 tests)**
- `pnpm --filter @acc/console exec tsc --noEmit`: **PASS (0 errors)**
