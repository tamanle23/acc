# Integration Master Plan (Iteration 4)
## Workstream 7: Visual DAG Studio Drag-and-Drop Authoring, Live Spring Boot Integration, Task Execution Ledger & Real-Time Telemetry Engine

---

## 1. Executive Summary & Vision

Building directly upon the battle-tested, zero-I/O distributed workflow engine established in **Iteration 3 (Workstream 6: Phases 26–30)**, **Iteration 4 (Workstream 7: Phases 31–35)** transforms the system from headless engine verification into a **fully integrated, end-to-end visual workflow authoring, live-executing, and real-time observable enterprise orchestration platform**.

### Core Evolution
1. **Interactive Drag-and-Drop Workflow Authoring (Visual DAG Studio)**:
   - Provide an extensible node palette (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, `DO_WHILE`).
   - Drag-and-drop onto the React Flow canvas with automatic connection snapping, directional handles, and edge routing.
   - Interactive Property Inspector side drawer for task parameters, `${workflow.input.*}` expressions, retry backoffs, and timeout limits.
   - Live bidirectional JSON IR serialization ensuring round-trip fidelity between visual DAG representations and production `WorkflowDefinition`s.
2. **Refactored `/tasks` Execution Units Ledger**:
   - Refactor `/tasks` from a standalone, generic Kanban list into the **official Task Execution Units Ledger** for the workflow engine.
   - Tasks are the discrete execution units of a Workflow Plan/Definition:
     - `workflowId` (parent workflow execution instance)
     - `taskReferenceName` (node key in the DAG)
     - `taskType` (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, `DO_WHILE`)
     - `status` (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMED_OUT`, `SKIPPED`)
     - Worker lease telemetry (`leaseOwner`, `visibleAtEpochMs`, `attempt`, `maxRetries`, `pollDomain`)
     - Input/output payload inspection with one-click **"View in Visual DAG Studio"** cross-navigation.
     - Dual-mode filter toggle between **Workflow Tasks** and **Manual Backlog Tasks**.
3. **Spring Boot REST & Application Lifecycle Bridge**:
   - Promote `apps/backend/workflow-engine` from a standalone library into the active Spring Boot runtime graph in `apps/backend`.
   - Implement `WorkflowDefinitionController`, `WorkflowExecutionController`, and `TaskWorkerController` exposing REST APIs.
   - Wire Spring Data DataSource / TransactionManager into the PostgreSQL/SQLite `PersistencePort` and launch background lease sweeping as managed Spring lifecycle beans.
4. **Live React Query Client Integration**:
   - Wire `@unipost/console` Visual DAG Studio to live backend endpoints via React Query hooks.
   - Real-time workflow triggering, execution status polling, and dynamic node progress coloring.
5. **WebSocket & SSE Live Execution Telemetry**:
   - Stream real-time task progress and state transitions from the engine to the console canvas via Server-Sent Events (SSE) or WebSockets.
6. **End-to-End Polyglot Distributed Execution Verification**:
   - Live end-to-end multi-tenant validation where visual authoring triggers distributed tasks executed cooperatively by Java 21 Virtual-Thread workers and pure TypeScript (`@unipost/worker`) workers, with automatic Saga rollback upon failure.
7. **Unified Sandbox Orchestration & Cross-Domain Synchronizer (`@unipost/sandbox`)**:
   - Update and elevate the Unified Sandbox Platform to natively simulate the entire distributed engine lifecycle in browser/local dev without a live backend:
     - In-memory workflow definitions catalog (`POST /api/v1/workflow/definitions`, `GET /api/v1/workflow/definitions`).
     - State-machine decider simulation with Kahn/Tarjan validation, parameter resolution, and branching.
     - Live synchronization between Visual DAG Studio execution instances and `/tasks` execution unit rows.
     - Mock SSE event stream dispatch (`GET /api/v1/workflow/executions/{id}/events`) simulating real-time task progress.
     - State reset integration with `SandboxDock` wiping mock executions and task leases simultaneously.

---

## 2. Iteration 4 Phase Roadmap (Phases 31 through 35)

| Phase | Milestone Title | Target Deliverables | Verification Mechanism |
| :---: | :--- | :--- | :--- |
| **Phase 31** | **Visual DAG Studio: Drag-and-Drop Canvas & Workflow Executions Ledger** | Draggable Task Palette (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, `DO_WHILE`); drag-and-drop drop handler with viewport coordinate projection; **Refactor `/tasks` screen & schema** into Workflow Executions Ledger (`workflowId`, `taskReferenceName`, `taskType`, worker lease telemetry) with direct bidirectional cross-navigation to Visual DAG Studio; lifecycle status tabs (**All**, **In Progress**, **Completed**, **Failed**); **Synchronize `@unipost/sandbox`** tasks repository with mock workflow executions. | Vitest tests in `@unipost/console` and `@unipost/sandbox` verifying palette drag-drop, node creation, and `/tasks` execution ledger rendering with workflow links. |
| **Phase 32** | **Visual DAG Studio: Task Property Inspector, Payload Drawer & Bidirectional IR Synchronizer** | Slide-over Property Inspector drawer for selected nodes; input parameter editor with auto-completion for `${workflow.input.*}` and `${taskRef.output.*}`; bidirectional JSON IR import/export with schema validation; Workflow Execution Instance Details dialog in `/tasks`; **Unified Sandbox mock workflow definitions catalog** (`/api/v1/workflow/definitions`). | Vitest tests verifying node attribute mutations, JSON IR compilation, sandbox definition storage, and round-trip fidelity without coordinate loss. |
| **Phase 33** | **Spring Boot REST Engine Bridge & Enterprise Persistence Wiring** | Spring Boot Controllers (`WorkflowDefinitionController`, `WorkflowExecutionController`, `TaskWorkerController`) in `apps/backend`; Spring Bean configuration wiring `PersistencePort`, `WorkflowEngineService`, and lease sweeper scheduler into active app graph. | MockMvc integration tests verifying workflow registration, execution start, worker task polling, and heartbeat reporting under active Spring security context. |
| **Phase 34** | **Live Console API Client, Server-Sent Events (SSE) & Sandbox Mock Stream** | `@tanstack/react-query` hooks (`useWorkflows`, `useWorkflowExecution`, `useStartWorkflow`) in console; SSE/WebSocket execution stream adapter; **Unified Sandbox mock SSE event stream** simulating real-time task progress; live canvas node pulsing during execution (`PENDING` $\to$ `IN_PROGRESS` $\to$ `COMPLETED`). | Integration tests with Unified Sandbox & live API client verifying execution stream message handling and node badge updates. |
| **Phase 35** | **Polyglot End-to-End Orchestration & Automated Saga Verification** | Full end-to-end integration scenario (E-commerce fulfillment DAG): visual authoring $\to$ API registration $\to$ Java worker inventory check $\to$ TypeScript worker label generation $\to$ simulated payment failure $\to$ reverse Saga compensation; **Sandbox Dock master reset** clearing all polyglot executions. | Automated end-to-end multi-worker test validating cross-language task completion, audit logs, and successful rollback of state. |

---

## 3. Deep Dive Phase Specifications & Gap Analyses

### Phase 31: Visual DAG Studio: Drag-and-Drop Canvas & Task Execution Unit Ledger Refactor

- **Task Palette Component (`dag-palette.tsx`)**:
  - Organized by category:
    - **Execution Nodes**: `SIMPLE` (Virtual-Thread or TypeScript Worker Task)
    - **Branching & Logic**: `SWITCH` (Condition Router), `DO_WHILE` (Loop Container)
    - **Concurrency**: `FORK_JOIN` (Parallel Fan-out), `DYNAMIC_FORK` (Array-driven Parallelism)
    - **Timing & Callbacks**: `WAIT` (Timestamp / External Webhook Resume)
  - Native HTML5 Drag and Drop (`onDragStart` setting `dataTransfer.setData('application/unipost-node-type', type)`).
  - Clean Liquid Glass card styling with specular highlights matching the existing design system.
- **Canvas Drop Target & Dynamic Node Creation (`visual-dag-studio.tsx`)**:
  - Implement `onDragOver` and `onDrop` on the `ReactFlow` wrapper.
  - Project drop screen coordinates to canvas flow coordinates using `screenToFlowPosition({ x, y })`.
  - Generate deterministic, collision-free `taskReferenceName` identifiers (e.g. `simpleTask_1`, `switch_1`).
  - Auto-connect to currently selected node when dropped within connection threshold.
- **Topological Edge Routing & Layout Controls**:
  - Algorithmic layout button to organize complex graphs into clean top-to-bottom or left-to-right topological flows.
  - Interactive edge creation (`onConnect`) preventing cyclic self-connections on non-`DO_WHILE` nodes.
  - Delete selected nodes or edges with keyboard shortcuts (`Delete`, `Backspace`) with confirmation toast.
- **Refactor `/tasks` into Workflow Executions Ledger**:
  - **Schema Modernization (`schema.ts`)**:
    - Add `workflowTaskExecutionSchema` defining: `taskId`, `workflowId`, `workflowName`, `taskReferenceName`, `taskType`, `status`, `leaseOwner`, `attempt`, `maxRetries`, `pollDomain`, `visibleAtEpochMs`, `durationMs`, `startedAt`, `completedAt`.
  - **Table Columns (`tasks-columns.tsx`)**:
    - Column 1: `Execution Unit / ID` with copy icon.
    - Column 2: `Workflow Definition` badge linking to `/workflows?workflowId={workflowId}`.
    - Column 3: `Task Type` pill (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `WAIT`, `DO_WHILE`).
    - Column 4: `Execution Status` (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMED_OUT`).
    - Column 5: `Worker Lease Telemetry` (`worker-node-1` / `lease: 15s left`).
    - Column 6: `Duration / Retries` (`attempt 1/3`, `245ms`).
    - Column 7: `Actions` (**View in Visual DAG Studio**, **Inspect Execution**, **Retry Lease**).
  - **Execution Lifecycle Filtering**:
    - Segmented tabs: **All Executions**, **In Progress**, **Completed**, **Failed / Action Required** (eliminating synthetic demo backlog tasks).
- **Unified Sandbox Platform Synchronization (`@unipost/sandbox` & `tasks-sandbox-handler.ts`)**:
  - Connect `TasksSandboxRepository` with `mockExecutions` from `packages/sandbox/src/handlers/workflow-handler.ts`.
  - When a workflow is started or stepped in Visual DAG Studio, matching `Task` execution units automatically populate the sandbox tasks store with consistent `workflowId`, `taskType`, and statuses.
  - Wire state reset to `SandboxDock` `handleResetAllData()`.
- **Verification Gate 31**:
  - Vitest test suite in `apps/console/src/features/metadata/components/studio/` verifying node dragging, drop coordinate translation, node creation, and deletion.
  - Vitest test suite in `apps/console/src/features/tasks/` verifying workflow executions table rendering, lifecycle tab filtering, and cross-navigation action.
  - Vitest test suite in `@unipost/sandbox` asserting synchronized task creation on workflow execution.

---

### Phase 32: Visual DAG Studio: Task Property Inspector, Payload Drawer & Bidirectional IR Synchronizer

- **Task Property Inspector Drawer (`dag-property-inspector.tsx`)**:
  - Slide-over sheet opening on node selection with tabbed sections:
    1. **General**: Task reference name, display label, description, worker domain (`default`, `payment`, `shipping`).
    2. **Parameters & Bindings**: Dynamic key-value editor for `inputParameters` supporting `${workflow.input.<field>}` and `${<taskRef>.output.<field>}` syntax with live validation.
    3. **Reliability & Policies**: `retryCount` (0-10), `retryDelaySeconds`, `backoffRate`, `timeoutSeconds`, and `compensateHandlerRef` (for distributed Sagas).
    4. **Conditions & Loops**: Expression editor for `SWITCH` condition routing (`decisionCases` mapping) and `DO_WHILE` loop constraints.
- **Task Payload & Telemetry Inspector Dialog (`task-payload-inspector-dialog.tsx`)**:
  - Integrated into `/tasks` rows:
    - View raw JSON `inputData` and `outputData`.
    - View error classification stack traces for `FAILED` tasks.
    - Inspect worker heartbeat history and remaining lease duration.
- **Bidirectional JSON IR Synchronizer**:
  - **Export**: Serializes the visual graph into canonical `workflow-ir-schema-v1.json` format, storing canvas coordinates in `layoutMetadata`.
  - **Import**: Parses valid Workflow IR JSON and instantiates React Flow nodes and edges with 100% preservation of metadata.
  - **Graph Validation Panel**: Runs client-side Kahn's acyclicity check and Tarjan cycle detection; surfaces visual error badges directly on cyclic nodes or missing input bindings.
- **Verification Gate 32**:
  - Vitest suite asserting property updates mutate node state, JSON IR compiles without loss, and cyclic connections display visual error highlights.

---

### Phase 33: Spring Boot REST Engine Bridge & Enterprise Persistence Wiring

- **Module Integration (`apps/backend`)**:
  - Include `workflow-engine` as a compile dependency in `apps/backend/pom.xml`.
  - Create configuration class `WorkflowEngineConfiguration` declaring Spring beans:
    - `PersistencePort` (autowiring `PostgresJdbcPersistenceAdapter` when Postgres is active or `SqliteJdbcPersistenceAdapter` when SQLite is active).
    - `WorkflowEngineService` singleton.
    - `ScheduledLeaseSweeper` running periodic background sweeps (`sweepExpiredTasks`) every 5 seconds.
- **REST API Layer (`com.unipost.workflow.adapter.rest`)**:
  - `WorkflowDefinitionController`:
    - `POST /api/v1/workflow/definitions` - Register / update workflow definition.
    - `GET /api/v1/workflow/definitions/{key}` - Retrieve definition and canvas layout metadata.
    - `GET /api/v1/workflow/definitions` - List all definitions for the active tenant.
  - `WorkflowExecutionController`:
    - `POST /api/v1/workflow/executions` - Start new workflow execution with input payload.
    - `GET /api/v1/workflow/executions/{id}` - Retrieve execution status, snapshots, and task execution history.
    - `POST /api/v1/workflow/executions/{id}/pause` / `resume` / `terminate`.
  - `TaskWorkerController`:
    - `GET /api/v1/workflow/tasks/poll` - Long-polling endpoint for workers (taskType, domain, workerId, batchSize).
    - `POST /api/v1/workflow/tasks/{id}/result` - Worker completes or fails task.
    - `POST /api/v1/workflow/tasks/{id}/heartbeat` - Lease extension heartbeat.
- **Multi-Tenant Context Preservation**:
  - Ensure all endpoints extract tenant and workspace context from the authenticated security principal (`X-Tenant-Id`, `X-Workspace-Id`, or JWT claims).
- **Verification Gate 33**:
  - Spring MockMvc integration tests verifying definition registration, execution lifecycle, worker polling, and lease recovery.

---

### Phase 34: Live Console API Client & Server-Sent Events (SSE) Execution Stream

- **TanStack Query Hooks (`apps/console/src/features/workflows/api/`)**:
  - `useWorkflowDefinitions()`: Fetch catalog of registered workflows.
  - `useWorkflowDefinition(key)`: Fetch active definition and layout metadata for Visual DAG Studio canvas.
  - `useSaveWorkflowDefinition()`: Mutation saving visual canvas changes to the backend.
  - `useStartWorkflowExecution()`: Mutation starting a live workflow instance with custom input JSON.
  - `useWorkflowExecutionStatus(executionId)`: Polling or stream hook tracking task statuses.
- **Real-Time Execution Stream (`useWorkflowExecutionStream`)**:
  - Connect to `GET /api/v1/workflow/executions/{id}/events` via Server-Sent Events (SSE).
  - Emits real-time task transition events (`TASK_SCHEDULED`, `TASK_IN_PROGRESS`, `TASK_COMPLETED`, `TASK_FAILED`, `WORKFLOW_COMPLETED`).
  - Directly updates node execution states on the React Flow canvas with smooth CSS transitions:
    - Glowing amber border for `IN_PROGRESS`.
    - Emerald green border for `COMPLETED`.
    - Pulsing red border with error tooltip for `FAILED`.
- **Execution Run Drawer**:
  - Bottom slide-over panel displaying real-time task logs, execution duration, payload inspect modals, and error traces.
- **Unified Sandbox Real-Time Mock Stream Adapter**:
  - `workflowSandboxHandler` implements mock SSE stream simulating staggered task state advances:
    - Automatically streams `TASK_SCHEDULED` $\to$ `TASK_IN_PROGRESS` $\to$ `TASK_COMPLETED` with configurable jitter.
    - Allows offline development and deterministic UI test automation without backend network infrastructure.
- **Verification Gate 34**:
  - Vitest component tests in `@unipost/console` mocking SSE events and asserting that canvas node badges dynamically update from `PENDING` $\to$ `IN_PROGRESS` $\to$ `COMPLETED`.
  - Vitest test in `@unipost/sandbox` verifying mock SSE event generator.

---

### Phase 35: Polyglot End-to-End Orchestration & Automated Saga Verification

- **Comprehensive End-to-End Fulfillment DAG Scenario**:
  ```
  [Start] 
     │
     v
  [1. Validate Order (Java Virtual Thread)]
     │
     v
  [2. Branch on Shipping Tier (SWITCH: express vs ground)]
    ├── express: [3a. Express Dispatch (TypeScript @unipost/worker)]
    └── ground:  [3b. Ground Cargo (TypeScript @unipost/worker)]
     │
     v
  [4. Parallel Fan-out (FORK_JOIN)]
    ├── [5a. Generate Digital Invoice (Java Virtual Thread)]
    └── [5b. Dispatch Warehouse Packing Event (TypeScript @unipost/worker)]
     │
     v
  [6. Payment Capture (Fault-Injected)]
     │ (Throws PaymentDeclinedException)
     v
  [7. Reverse Saga Compensation Flow]
    ├── Compensate 5b: Cancel Packing Job
    ├── Compensate 5a: Void Digital Invoice
    └── Compensate 1:  Release Inventory Hold
  ```
- **Execution Matrix**:
  - Java workers register using `WorkerHost`.
  - TypeScript workers register using `@unipost/worker` running in Node/Bun or Vite runtime.
  - Engine coordinates leases, dispatches to matching workers, tracks heartbeat renewals, and triggers `SagaCompensator` upon failure.
- **Verification Gate 35**:
  - Automated integration test asserting all 7 steps execute in order, compensation reverses completed steps in exact reverse topological order, and final execution status reaches `COMPENSATED_FAILED`.

---

## 4. Architectural Invariants Summary

| # | Invariant | Description |
| :-: | :--- | :--- |
| **1** | **Zero-I/O Core Purity** | Functional core (`PureDecider`) remains strictly detached from Spring Boot, database drivers, and network I/O. |
| **2** | **Bidirectional Canvas Fidelity** | Visual modifications (drag-drop, coordinate moves, parameter edits) must round-trip to Canonical JSON IR with zero data loss. |
| **3** | **Task as Workflow Execution Unit** | Tasks are first-class executions of Workflow Plans (`workflowId`, `taskReferenceName`, `taskType`, worker lease telemetry). |
| **4** | **Single-Column Lease Reliability** | Task distribution relies on `visible_at_epoch_ms` across both PostgreSQL and SQLite adapters; zero external broker requirements. |
| **5** | **Symmetric Polyglot Contracts** | Java Virtual-Thread workers and TypeScript (`@unipost/worker`) workers share identical JSON payloads, middleware behavior, and heartbeat mechanics. |
| **6** | **Multi-Tenant Context Propagation** | Every workflow definition, execution, task outbox event, and telemetry stream preserves `tenant_id` and `workspace_id`. |
| **7** | **Zero Synthetic Mocks in Verification** | All integration tests execute against real production classes, real database schemas, and actual network/SSE protocol handlers. |
