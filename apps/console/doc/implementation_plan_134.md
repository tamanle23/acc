# Implementation Plan 134: Iteration 13 — Workstream 4 & 5 Full-Stack Alignment, Advanced Visual JSON Editor, Autonomous Workflow Orchestration, `@unipost/worker` 4-Layer SDK, Refined DAG Studio, Deterministic Schema Synthesis & Engine-Level Workflow Visual Debugger

**Master Reference:** [`docs/integration_master_plan_iteration13.md`](../../../docs/integration_master_plan_iteration13.md)

## Phased Execution Checklist

- [ ] **Phase 1: Re-Verify & Align Workstream 4 & Workstream 5 (Backend ↔ Frontend)**
  - [ ] Fix `WorkflowEngineService.applyCommands` to upsert via `saveTaskExecution` on new `UpdateTaskStatus` commands (`HUMAN`, `HTTP`, `SET_VARIABLE`, `SWITCH`).
  - [ ] Add `WorkflowApprovalsController` (`/api/v1/workflows/approvals` & `/api/v1/workflow/approvals`) in `unipost-ms-aio`.
  - [ ] Enrich `EntityWorkflowTriggerDispatcher` `APPROVAL_REQUESTED` SSE payloads.
  - [ ] Add recursive `jsonb` PII masking & schema-driven sensitivity support in `FieldLevelSecuritySerializer`.
  - [ ] Embed `VisualJsonEditor` in `dlq-inspector-sheet.tsx` and restore-preview diff inspection in `master-detail-row-inspector.tsx`.
- [ ] **Phase 2: Visual JSON Editor Advanced Capabilities (`@unipost/console`)**
  - [ ] Add real-time search & filter bar with match badge and ancestor auto-expansion in `visual-json-editor.tsx`.
  - [ ] Add array item Move Up / Move Down reordering controls in `json-tree-node.tsx` and `json-form-row.tsx`.
  - [ ] Add non-blocking inline JSON Schema validation (`jsonSchema` + `onValidationChange`) with node/row error badges.
- [ ] **Phase 3: Core Workflow Engine Orchestration (`@unipost/backend`)**
  - [ ] Add explicit `workflowId` to `TaskSnapshot` across all persistence adapters.
  - [ ] Add `taskDefName` routing (defaulting to `taskReferenceName`) in `TaskDefinition`, `SimpleTaskStrategy`, and `PersistencePort.pollTasks`.
  - [ ] Advance elapsed `WAIT` timers in `ScheduledLeaseSweeper` and broadcast SSE updates.
- [ ] **Phase 4: `SIMPLE` Task Worker Registration Protocol & 4-Layer SDK (`@unipost/worker`, `@unipost/sandbox`, `@unipost/backend`)**
  - [ ] Upgrade `@unipost/worker` (`packages/worker`) with `TaskWorkerDescriptor`, `/register` handshake, periodic `/heartbeat`, fixed `workflowId` resolution, and CLI runner.
  - [ ] Bridge `@unipost/worker` into `@unipost/sandbox` via `InMemorySandboxWorkerTransport`.
  - [ ] Add `@WorkflowTaskWorker`, `SimpleTaskWorkerRegistrar`, `HttpWorkerTransportAdapter`, and `/register` + `/catalog` endpoints in `WorkerFleetController`.
- [ ] **Phase 5: Refine Workflow Designer (`VisualDagStudio`)**
  - [ ] Add "Bind to Registered Worker" catalog selector in `dag-property-inspector.tsx`.
  - [ ] Add Topological Auto-Layout (`LR` / `TB`) and Undo/Redo (`Cmd+Z` / `Cmd+Y`) in `visual-dag-studio.tsx`.
  - [ ] Add upstream variable autocomplete pills and `VisualJsonEditor` in `dag-property-inspector.tsx`.
- [ ] **Phase 6: Deterministic AI-Assisted Schema Generation (`VisualSchemaStudio` & Backend)**
  - [ ] Implement deterministic `AiSchemaSynthesizerService` & `AiSchemaSynthesizerController` (`POST /api/v1/metadata/ai/synthesize-schema`) + sandbox handler.
  - [ ] Implement `AiSchemaGeneratorModal` in `VisualSchemaStudio` with Domain Prompt and Sample JSON AST Inference tabs.
- [ ] **Phase 7: Workflow Visual Debugger (Server-Side & Sandbox Engine Breakpoints)**
  - [ ] Add `PAUSED_AT_BREAKPOINT` status, engine breakpoint halting in `PureDecider`, and `/breakpoints`, `/pause`, `/step`, `/resume`, and `/tasks/{taskRef}/rerun` endpoints.
  - [ ] Add visual node breakpoint toggles, Debugger Toolbar, "Edit Input & Re-Run Node" in `TaskTelemetryInspector`, and Time-Travel Variable Watch drawer.
