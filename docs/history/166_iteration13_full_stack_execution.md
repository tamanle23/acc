# 166 — Iteration 13 End-to-End Full-Stack Execution (Phases 1–7)

## 1. Problem Statement
Following the formulation of the Iteration 13 Master Plan (`docs/integration_master_plan_iteration13.md`), the platform required full-stack execution across 7 cohesive phases with zero stubs:
1. Full-stack alignment of Workstreams 4 & 5 (`WorkflowApprovalsController`, `WorkflowEngineService` task upsert on `UpdateTaskStatus`, recursive `jsonb` PII masking in `FieldLevelSecuritySerializer`, enriched `APPROVAL_REQUESTED` SSE payloads, and `VisualJsonEditor` integration in DLQ and Record Audit inspectors).
2. Advanced capabilities in `VisualJsonEditor` (real-time key/value search & filter with ancestor auto-expansion, array item Move Up/Move Down reordering, and non-blocking inline JSON Schema validation).
3. Core Workflow Engine orchestration fixes (`TaskSnapshot.workflowId` extraction for IDs containing underscores, and `pollTasks` matching by `taskType` or `referenceName`).
4. 4-layer `SIMPLE` Task Worker Registration Protocol & SDK across `@acc/backend`, `@acc/worker`, `@acc/sandbox`, and `@acc/console`.
5. `VisualDagStudio` & `DagPropertyInspector` refinements ("Bind to Registered Worker" catalog selector, upstream variable reference pills, topological Auto-Layout, and `Cmd+Z`/`Cmd+Y` undo/redo).
6. Deterministic AI-assisted Schema & FSM Synthesizer (`POST /api/v1/metadata/ai/synthesize-schema` + `AiSchemaGeneratorModal`).
7. Server-side and Sandbox Workflow Visual Debugger (`PAUSED_AT_BREAKPOINT`, breakpoints, `pause`, `step`, `resume`, and `rerun` from node with overridden inputs).

## 2. Plan & Architecture
- **Phase 1**: Update `WorkflowEngineService.java`, `FieldLevelSecuritySerializer.java`, `EntityWorkflowTriggerDispatcher.java`, create `WorkflowApprovalsController.java`, and wire `VisualJsonEditor` + `usePreviewRestoreRecord` in `@acc/console`.
- **Phase 2**: Upgrade `visual-json-editor.tsx`, `json-tree-node.tsx`, and `json-form-row.tsx` with search/filter, array reordering, and `validateAgainstJsonSchema`.
- **Phase 3**: Update `TaskSnapshot.java`, `InMemoryPersistenceAdapter.java`, and `PostgresJdbcPersistenceAdapter.java`.
- **Phase 4**: Implement `@WorkflowTaskWorker`, `TaskWorkerDescriptor`, `HttpWorkerTransportAdapter`, `SimpleTaskWorkerRegistrar`, and `/register` + `/catalog` endpoints in Java; upgrade `@acc/worker` (`WorkflowWorkerHost`, `HttpWorkerTransportClient`, `TaskPoller`, `runner.ts`) and Unified Sandbox handlers.
- **Phase 5**: Upgrade `dag-property-inspector.tsx` with `useWorkerCatalog()` selector, upstream variable pills, and `VisualJsonEditor`; add topological Auto-Layout and Undo/Redo in `visual-dag-studio.tsx`.
- **Phase 6**: Implement `AiSchemaSynthesizerService` & `AiSchemaSynthesizerController` in `acc-fw`, sandbox handler in `metadata-sandbox-adapter.ts`, and `AiSchemaGeneratorModal` in `VisualSchemaStudio`.
- **Phase 7**: Implement `PAUSED_AT_BREAKPOINT` in `WorkflowStatus` & `PureDecider`, debugger endpoints in `WorkflowExecutionController` & `workflow-handler.ts`, breakpoint gutter dots on `DagWorkflowNodeComponent`, Debugger Toolbar & Variable Watch drawer in `VisualDagStudio`, and "Edit Input & Re-Run From Node" in `TaskTelemetryInspector`.

## 3. Key Changes Made
- **Backend (`workflow-engine`, `acc-fw`, `acc-ms-aio`)**:
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/domain/model/TaskSnapshot.java`
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/domain/model/WorkflowStatus.java`
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/domain/service/PureDecider.java`
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapter/persistence/InMemoryPersistenceAdapter.java`
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapter/persistence/PostgresJdbcPersistenceAdapter.java`
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/service/WorkflowEngineService.java`
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/sdk/WorkflowTaskWorker.java`
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/sdk/TaskWorkerDescriptor.java`
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/sdk/WorkerHost.java`
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/sdk/HttpWorkerTransportAdapter.java`
  - `apps/backend/acc-fw/src/main/java/vn/acc/fw/metadata/security/FieldLevelSecuritySerializer.java`
  - `apps/backend/acc-fw/src/main/java/vn/acc/fw/metadata/workflow/EntityWorkflowTriggerDispatcher.java`
  - `apps/backend/acc-fw/src/main/java/vn/acc/fw/metadata/ai/AiSchemaSynthesizerService.java`
  - `apps/backend/acc-fw/src/main/java/vn/acc/fw/metadata/ai/AiSchemaSynthesizerController.java`
  - `apps/backend/acc-ms-aio/src/main/java/vn/acc/ms/aio/workflow/WorkflowApprovalsController.java`
  - `apps/backend/acc-ms-aio/src/main/java/vn/acc/ms/aio/workflow/SimpleTaskWorkerRegistrar.java`
  - `apps/backend/acc-ms-aio/src/main/java/vn/acc/ms/aio/workflow/WorkerRegistry.java`
  - `apps/backend/acc-ms-aio/src/main/java/vn/acc/ms/aio/workflow/WorkerFleetController.java`
  - `apps/backend/acc-ms-aio/src/main/java/vn/acc/ms/aio/workflow/WorkflowExecutionController.java`
- **Worker SDK (`packages/worker`) & Sandbox (`packages/sandbox`)**:
  - `packages/worker/src/types.ts`, `packages/worker/src/host/TaskPoller.ts`, `packages/worker/src/client/HttpWorkerTransportClient.ts`, `packages/worker/src/host/WorkflowWorkerHost.ts`, `packages/worker/src/runner.ts`, `packages/worker/src/index.ts`
  - `packages/sandbox/src/handlers/workflow-handler.ts`
- **Console (`apps/console`)**:
  - `apps/console/src/components/ui/json-editor/visual-json-editor.tsx`, `json-tree-node.tsx`, `json-form-row.tsx`, `visual-json-editor.test.tsx`
  - `apps/console/src/features/dlq/components/dlq-inspector-sheet.tsx`
  - `apps/console/src/features/metadata/components/data-explorer/master-detail-row-inspector.tsx`
  - `apps/console/src/core/sandbox/handlers/worker-sandbox-handler.ts`, `metadata-sandbox-adapter.ts`
  - `apps/console/src/features/workers/api/worker-fleet-api.ts`
  - `apps/console/src/features/workflows/api/workflow-api.ts`
  - `apps/console/src/features/metadata/api/metadata-api.ts`
  - `apps/console/src/features/metadata/components/studio/ai-schema-generator-modal.tsx`
  - `apps/console/src/features/metadata/components/studio/visual-schema-studio.tsx`
  - `apps/console/src/features/metadata/components/studio/dag-property-inspector.tsx`
  - `apps/console/src/features/metadata/components/studio/dag-node.tsx`
  - `apps/console/src/features/metadata/components/studio/task-telemetry-inspector.tsx`
  - `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`
  - `apps/console/src/features/metadata/components/studio/iteration13-studio.test.tsx`

## 4. Verification
- Backend `workflow-engine`, `acc-fw`, and `acc-ms-aio` unit & integration suites passed with 0 errors.
- `@acc/worker` Vitest suite: 4 test files, 7 tests passed.
- `@acc/sandbox` Vitest suite: 9 test files, 94 tests passed.
- `@acc/console` Vitest suites (`visual-json-editor.test.tsx`, `iteration13-studio.test.tsx`): 6 tests passed.
- `@acc/console` TypeScript check (`tsc --noEmit`): 0 errors.
