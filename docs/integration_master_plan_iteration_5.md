# Integration Master Plan (Iteration 5)
## Workstream 8: Enterprise Visual DAG Studio 2.0, Human-in-the-Loop Operations, Resilient Lease Queue & Poison DLQ, Definition Versioning, Tamper-Evident Audit Ledger & Time-Travel Fleet Telemetry

---

## 1. Executive Summary & Vision

Following the successful execution of **Iteration 3 (Zero-I/O Functional Engine, Single-Column Lease Queue & Polyglot Worker SDKs)** and **Iteration 4 (Drag-and-Drop Visual Studio, Spring Boot REST Bridge, Live SSE Telemetry & Distributed Saga Verification)**, **Iteration 5 (Workstream 8: Phases 36–40)** elevates the Unipost Workflow Platform from a functional distributed orchestrator into an **enterprise-grade, mission-critical, human-governed, and self-healing workflow infrastructure**.

### Core Evolution & Strategic Value

1. **Visual DAG Studio 2.0 (Full 23-Node Palette & Specialized Property Inspectors)**:
   - Bring the visual authoring experience into 100% parity with the backend `com.unipost.workflow.core.model.TaskType` engine.
   - Expand the canvas palette into 5 categorized domains:
     - **Control Flow**: `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, `DO_WHILE`, `EXCLUSIVE_JOIN`, `TERMINATE`, `SUB_WORKFLOW`, `START_WORKFLOW`
     - **Data & Transformation**: `SET_VARIABLE`, `JSON_JQ_TRANSFORM`, `INLINE` (Groovy/MVEL/JavaScript)
     - **System Connectors & I/O**: `HTTP`, `JDBC`, `KAFKA_PUBLISH`, `NOOP`
     - **Human & Governance**: `HUMAN` (Interactive Approval & Manual Review Gates)
     - **AI & Emerging Integrations**: `LLM_CHAT_COMPLETE`, `CALL_MCP_TOOL`, `DYNAMIC`
   - Implement specialized, schema-driven Property Inspector panels for each node type (e.g. HTTP method/headers/body, SQL query builders, JQ syntax highlighters, LLM prompt templates, Kafka topic config).
   - Ensure lossless bidirectional synchronization between visual graphs and Canonical JSON IR.
   - Enhance the Unified Sandbox Platform (`@unipost/sandbox`) to simulate all 23 node types offline with zero backend dependencies.
   - **Appended Requirement (Implementation Plan 98 - Dual Operational Modes)**:
     - Provide two strictly isolated operational modes:
       - **Full Mode (`full` / `designer`)**: Workflow definition authoring with 23-node categorized accordion palette, specialized Property Inspector forms, Kahn/Tarjan acyclic graph topology validator, and backend definition catalog persistence.
       - **Read-Only Mode (`readonly` / `execution`)**: Topology-locked interactive runtime visualizer for live SSE execution monitoring and historical time-travel back-testing with a docked bottom playback scrubber (Play, Pause, Step Next/Prev, Speed 0.5x–5x, Auto-Follow Live HEAD with pause-to-scrub) and a slide-over Task Telemetry Inspector (runtime resolved inputs/outputs, worker lease ID, duration, and node logs).
     - Strict Context Isolation: Read-Only mode is strictly bound to runtime execution views (`/tasks`, `TaskExecutionStreamModal`); Full Mode is strictly accessed via the Workflow Catalog (`/workflows`) designer.

2. **Human-in-the-Loop (HITL) Operations & Task Approval Inbox**:
   - Provide first-class operational tooling for workflows that require human decision-making, verification, or administrative override.
   - Dedicated **Task Approval Inbox** UI (`/approvals` or `/tasks?tab=approvals`) in `@unipost/console` with SLA urgency countdowns and role-based assignment.
   - Interactive Decision Modal allowing reviewers to inspect upstream execution payloads, provide decision rationales, and approve or reject steps.
   - Robust backend lifecycle management: task claiming, decision resolution (`POST /api/v1/workflow/tasks/{id}/resolve`), and timeout escalation policies.

3. **Enterprise Resilient Lease Queue, Poison DLQ & Priority Queuing**:
   - Harden the distributed single-column lease queue (`visible_at_epoch_ms`) for high-throughput, multi-tenant operations.
   - **Poison Task Dead-Letter Queue (`task_dlq`)**: Automatically isolate tasks that exceed `maxRetries` or experience unrecoverable crashes, preventing head-of-line blocking in worker queues.
   - **Priority Queue Multi-Tenant Tiering**: Prioritize task dispatching based on tenant subscription tiers (`ENTERPRISE` = 100, `PRO` = 50, `STANDARD` = 10) backed by PostgreSQL `FOR UPDATE SKIP LOCKED`.
   - **Jittered Polling & Anti-Thundering Herd**: Exponential backoff with randomized jitter in both Java Virtual-Thread `WorkerHost` and TypeScript `@unipost/worker` SDKs.
   - **Distributed Lease Heartbeat Drift & Zombie Worker Reaper**: Virtual-thread background sweeps reclaiming orphaned leases from crashed worker processes.

4. **Workflow Definition Versioning, Hot Migration & Tamper-Evident Audit Ledger**:
   - **Semantic Definition Versioning**: Formal lifecycle states (`DRAFT` $\to$ `ACTIVE` $\to$ `DEPRECATED` $\to$ `ARCHIVED`) supporting concurrent versions (`v1`, `v2`, `v3`) with atomic cutovers.
   - **In-Flight Execution Migration Engine**:
     - *Policy A (Safe Default)*: Running executions stay pinned to their immutable Memento `definition_snapshot`.
     - *Policy B (Hot Migration)*: Forward state mapping of running DAGs to newer definition versions if topological graph checkpoints and variable schemas are backward-compatible.
   - **Tamper-Evident Cryptographic Audit Ledger (`workflow_audit_log`)**:
     - Immutable, append-only audit trail linking every lifecycle transition with SHA-256 hash chaining (`prev_hash` $\to$ `current_hash`).
     - Cryptographic verification APIs guaranteeing enterprise SOC2 and ISO 27001 compliance.

5. **Visual Time-Travel Execution Replay, Worker Fleet Telemetry & Chaos Verification**:
   - **Visual Time-Travel Replay**: Interactive scrubber slider in Visual DAG Studio allowing operators to rewind and play back execution history microsecond by microsecond, observing variable mutations and node status transitions.
   - **Fork & Re-run from Failed Node**: Allows operators to fix bad input data and resume a failed execution from an arbitrary checkpoint without re-running completed side-effects.
   - **Worker Fleet Telemetry Dashboard**: Real-time observability over connected polyglot worker hosts, poll domains, active concurrency slots, memory/CPU usage, and lease health.
   - **Enterprise Chaos & Stress Suite**: 1,000-execution concurrent test injecting simulated worker process kills, network latency, and database failovers to guarantee automated recovery and zero state corruption.

---

## 2. Iteration 5 Phase Roadmap (Phases 36 through 40)

| Phase | Milestone Title | Target Deliverables | Verification Mechanism |
| :---: | :--- | :--- | :--- |
| **Phase 36** | **Visual DAG Studio 2.0: Full 23-Node Palette, Specialized Property Inspectors & Sandbox Simulation Engine** | Palette grouped into 5 categories with 23 node types; custom Liquid Glass node cards with semantic icons and multi-port handles; schema-driven Property Inspector panels (HTTP, SQL, JQ, Groovy, LLM, Kafka, MCP); bidirectional Canonical JSON IR converter; `@unipost/sandbox` mock decider simulating all 23 node types offline; Dual Modes architecture (Full authoring vs Read-Only live preview & time-travel back-test with scrubber and telemetry inspector). | Vitest tests in `@unipost/console` and `@unipost/sandbox` verifying palette dragging, parameter editing, JSON IR compilation, mode locking, time-travel event progression, and offline execution of all node types. |
| **Phase 37** | **Human-in-the-Loop (HITL) Operations: Task Approval Inbox, Decision Modals & SLA Tracking** | Dedicated Approval Inbox UI with SLA countdowns; Decision Modal with payload inspector and decision comment capture; backend REST endpoints (`/claim`, `/resolve`); timeout escalation handlers; real-time SSE notifications for pending approvals. | Spring MockMvc tests asserting task claiming, decision submission, and DAG resumption; Vitest tests verifying approval inbox UI filtering, optimistic state updates, and countdown timers. |
| **Phase 38** | **Enterprise Resilient Lease Queue: PostgreSQL SKIP LOCKED, Priority Queuing, Poison DLQ & Distributed Recovery** | Dedicated `task_dlq` table and management REST APIs (`/dlq`, `/replay`, `/discard`); tenant tier priority scheduling (`ENTERPRISE` = 100, `PRO` = 50, `STANDARD` = 10); jittered backoff poller in Java & TypeScript workers; zombie worker lease reaper; Micrometer/Prometheus metrics. | Concurrent stress tests in JUnit 5 asserting zero race conditions under `SKIP LOCKED`, priority preemption, and automated DLQ isolation of poison tasks after max retries. |
| **Phase 39** | **Workflow Definition Versioning, Hot Migration Policies & Tamper-Evident Audit Ledger** | Semantic definition versioning (`DRAFT`, `ACTIVE`, `DEPRECATED`, `ARCHIVED`); dual migration policies (frozen Memento snapshot vs topological Hot Migration); cryptographic hash-chained audit ledger (`workflow_audit_log` with SHA-256 validation); visual graph diff viewer in Visual DAG Studio between versions. | Unit and integration tests verifying hash-chain validation, tamper detection, and hot migration of in-flight execution checkpoints without data loss. |
| **Phase 40** | **Visual Time-Travel Execution Replay, Worker Fleet Telemetry & Chaos Verification** | Interactive execution timeline scrubber in Visual DAG Studio; snapshot diff inspector; "Fork & Re-run from Node" action; Worker Fleet Dashboard (`/system/workers`) monitoring live Java & TypeScript workers; 1,000-execution chaos test with network partition and process kill injection. | Chaos test suite asserting 100% data consistency, automatic reverse Saga rollbacks, and flawless lease recovery under extreme stress. |

---

## 3. Deep Dive Phase Specifications & Technical Blueprints

```mermaid
flowchart TD
    subgraph Studio ["Visual DAG Studio 2.0 (Phase 36)"]
        VDS["Visual DAG Studio 2.0"]
        VDS -->|mode = 'full' | 'designer'| FULL["Full Authoring Mode"]
        VDS -->|mode = 'readonly' | 'execution'| RO["Read-Only Mode"]

        subgraph FullMode ["Full Authoring Mode"]
            FULL --> Palette["23-Node Categorized Palette<br/>(Accordion + Search)"]
            FULL --> CanvasFull["Editable Canvas<br/>(Add, Delete, Relink)"]
            FULL --> Inspector["Specialized Property Inspector<br/>(HTTP, SQL, JQ, LLM, etc.)"]
            FULL --> IR["Canonical JSON IR"]
        end

        subgraph ReadOnlyMode ["Read-Only Mode"]
            RO --> CanvasRO["Topology Locked Canvas<br/>(nodesConnectable=false)"]
            RO --> Stream["Live SSE Telemetry Stream<br/>(Auto-Follow HEAD)"]
            RO --> Scrubber["Docked Time-Travel Scrubber<br/>(Play/Pause/Step/Speed)"]
            RO --> Telemetry["Slide-Over Task Telemetry Inspector<br/>(Payloads, Worker Lease, Timing)"]
        end

        IR --> Sandbox["Offline Sandbox Decider"]
    end

    subgraph Operations ["Human Governance & Operations (Phase 37)"]
        HumanNode["HUMAN Task Gate"] --> Inbox["Approval Inbox UI"]
        Inbox --> Decision["Claim & Resolve Modal"]
        Decision --> Resume["Resume DAG Execution"]
    end

    subgraph Resilience ["Resilient Infrastructure & Fleet (Phases 38-40)"]
        LeaseQueue["Priority Lease Queue (SKIP LOCKED)"] --> Workers["Polyglot Workers (Java/TS)"]
        Workers -- "Failure > maxRetries" --> DLQ["Poison Task DLQ"]
        Workers -- "Audit Events" --> Audit["SHA-256 Tamper-Evident Ledger"]
        Audit --> Replay["Visual Time-Travel Replay"]
    end

    CanvasFull -.-> HumanNode
    IR -.-> LeaseQueue
```

---

### Phase 36: Visual DAG Studio 2.0: Full 23-Node Palette, Specialized Property Inspectors & Sandbox Simulation Engine

#### 1. Strategic Objective
Elevate the visual authoring environment in `@unipost/console` to provide native support for all 23 task node types implemented in the Java workflow engine, eliminating gaps between the visual designer and backend runtime capabilities.

#### 2. Visual Palette Expansion (`dag-palette.tsx`)
Organize all 23 task node types into 5 clean, collapsible category sections:
1. **Control Flow (9 nodes)**:
   - `SWITCH`: Multi-branch conditional router (`condition`, `decisionCases`, `defaultCase`).
   - `FORK_JOIN`: Static parallel branch fan-out (`forkTasks`).
   - `DYNAMIC_FORK`: Dynamic parallel fan-out based on input array (`dynamicForkTasksInputParamName`).
   - `WAIT`: Pauses execution until timestamp or external resume signal (`waitTimeMs`, `resumeWebhook`).
   - `DO_WHILE`: Cyclic loop container with termination expression (`loopCondition`).
   - `JOIN`: Standard barrier synchronizer waiting for all incoming fork branches.
   - `EXCLUSIVE_JOIN`: First-win barrier synchronizer completing as soon as the first branch finishes.
   - `TERMINATE`: Fast-exit operator halting the workflow with explicit status (`COMPLETED` or `FAILED`).
   - `SUB_WORKFLOW`: Synchronous invocation of a child workflow definition with context propagation.
   - `START_WORKFLOW`: Asynchronous fire-and-forget launch of an independent workflow.
2. **Data & Transformation (3 nodes)**:
   - `SET_VARIABLE`: Pure in-memory variable mutation and state management (`variables`).
   - `JSON_JQ_TRANSFORM`: High-performance JSON reshaping without worker latency (`queryExpression`).
   - `INLINE`: Dynamic expression evaluation (Groovy, MVEL, or JavaScript) in a sandboxed script engine.
3. **System Connectors & I/O (4 nodes)**:
   - `HTTP`: Built-in HTTP/REST connector (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`) with header and body templates.
   - `JDBC`: Direct SQL query execution against configured datasources (`datasourceId`, `sql`, `parameters`).
   - `KAFKA_PUBLISH`: Event streaming publisher to Apache Kafka topics (`topic`, `key`, `message`).
   - `NOOP`: Pass-through node for clean visual graph edge routing and alignment.
4. **Human & Governance (1 node)**:
   - `HUMAN`: Interactive manual approval/review gate requiring human operator sign-off before downstream progression.
5. **AI & Emerging Integrations (3 nodes)**:
   - `LLM_CHAT_COMPLETE`: Direct multi-provider LLM prompt execution (OpenAI, Gemini, Anthropic, Ollama).
   - `CALL_MCP_TOOL`: Model Context Protocol tool invocation (`serverName`, `toolName`, `arguments`).
   - `DYNAMIC`: Runtime task definition resolution computed dynamically from upstream outputs.

#### 3. Specialized Property Inspector Drawer (`dag-property-inspector.tsx`)
Create dedicated inspector panels tailored to each node type:
- **HTTP Inspector**:
  - HTTP Method selector (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
  - URL input with autocomplete for `${workflow.input.*}` and `${workflow.variables.*}`.
  - Key-value table for Request Headers with preset buttons (`Bearer Auth`, `Content-Type: application/json`).
  - Monaco/Code editor for JSON Request Body.
  - Expected HTTP status assertions (e.g. `200, 201`) and read timeout in seconds.
- **SQL / JDBC Inspector**:
  - Datasource identifier dropdown (e.g. `default`, `analytics_db`, `billing_db`).
  - SQL statement editor with SQL syntax highlighting.
  - Query parameters mapping array.
- **JSON JQ Transform Inspector**:
  - Input JSON payload expression (e.g. `${fetchOrder.output.body}`).
  - JQ filter expression input with real-time test preview against sample data.
- **Inline Script Inspector**:
  - Language dropdown: `groovy`, `mvel`, `javascript`.
  - Sandboxed code editor with evaluation timeout configuration.
- **LLM Completion Inspector**:
  - Provider selector (`openai`, `gemini`, `anthropic`, `local`).
  - Model name input (`gpt-4o`, `gemini-1.5-pro`, `claude-3-5-sonnet`).
  - Temperature slider (0.0 to 1.0) and Max Tokens input.
  - System Prompt and User Prompt template textareas with variable interpolation.
- **Human Approval Inspector**:
  - Assignment Target: User ID, Role (`WORKFLOW_APPROVER`), or Dynamic Expression.
  - Timeout limit and escalation policy (`escalationHandlerRef`).
  - Dynamic Form Schema builder: configure fields that the human approver must fill or verify.
- **Terminate & Sub-Workflow Inspectors**:
  - `TERMINATE`: Status selector (`COMPLETED` vs `FAILED`), Termination Reason expression.
  - `SUB_WORKFLOW`: Target workflow key, Version selector, Input parameter mappings.

#### 4. Unified Sandbox Offline Simulation Engine (`packages/sandbox`)
Enhance `workflowSandboxHandler` in `@unipost/sandbox`:
- Support client-side execution simulation for all 23 node types without requiring a running Java backend.
- Evaluate `${workflow.variables.*}` and `SET_VARIABLE` mutations in memory.
- Simulate `HTTP` requests using mocked responses configured in the sandbox dock.
- Simulate `HUMAN` approval gates by keeping the task in `WAITING_FOR_APPROVAL` until approved via the sandbox UI.
- Provide deterministic golden trace tests ensuring 100% parity between sandbox simulation and Spring Boot execution.

#### 5. Dual Operational Modes Architecture (Implementation Plan 98 Integration)
As formalized in `apps/console/doc/implementation_plan_98.md`, Visual DAG Studio 2.0 introduces two distinct, strictly isolated operational modes:
1. **Full Mode (`mode="full"` / `"designer"`)**:
   - Comprehensive workflow definition authoring with the 23-node categorized accordion palette, specialized configuration inspectors, Kahn/Tarjan acyclic graph topology validator, and backend save mutations.
   - Canvas is fully interactive: `nodesConnectable={true}`, `nodesDraggable={true}`, `elementsSelectable={true}`, palette and save buttons active.
2. **Read-Only Mode (`mode="readonly"` / `"execution"`)**:
   - Topology-locked interactive runtime visualizer for live SSE execution monitoring and historical time-travel back-testing.
   - Topology locking: `nodesConnectable={false}`, `nodesDraggable={false}`, `elementsSelectable={true}`, palette hidden, delete/save buttons hidden. Panning, zooming, and node selection remain fully interactive.
   - Backward-compatibility aliases: accepts `mode?: 'full' | 'readonly' | 'designer' | 'execution'` (`'designer'` aliases `'full'`, `'execution'` aliases `'readonly'`).
   - **Strict Context Isolation**: No direct in-canvas mode-switching buttons; Read-Only mode is strictly bound to runtime execution views (`/tasks`, `TaskExecutionStreamModal`), while Full Mode is strictly accessed via the Workflow Catalog (`/workflows`) designer.

##### 5.1 Docked Time-Travel Scrubber (`time-travel-scrubber.tsx`)
A floating docked bottom bar spanning the canvas in Read-Only Mode:
- **Playback Controls**: Play / Pause, Step Backward, Step Forward, Speed Selector (`0.5x`, `1x`, `2x`, `5x`).
- **Timeline Progress Bar**: Microsecond-accurate slider with markers/ticks for each historical execution event.
- **Auto-Follow Live HEAD with Pause-to-Scrub**:
  - Automatically follows real-time SSE execution events at HEAD with a pulsing `LIVE (HEAD)` badge.
  - Dragging the scrubber or clicking Pause detaches from live updates into Time-Travel replay mode; a `Resume Live` button snaps back to real-time.
  - For completed executions, it loads the full event history ready for scrubbing.
- **Event Legend**: Displays timestamp, event type (`TASK_IN_PROGRESS`, `TASK_COMPLETED`, etc.), and target task reference.

##### 5.2 Slide-Over Task Telemetry Inspector (`task-telemetry-inspector.tsx`)
Slide-over sheet triggered when a node is clicked in Read-Only Mode:
- **Header**: Task Reference Name, Task Type, Status Badge (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMED_OUT`).
- **Execution Timing**: Scheduled Time, Started Time, Ended Time, Duration (e.g. `142ms`).
- **Worker Metadata**: Worker Node ID / Host, Poll Lease ID, Attempt / Retry Count.
- **Payload Inspection**:
  - Input Payload (resolved evaluated values passed to worker).
  - Output Payload (actual JSON result returned from worker).
  - Error Details (if status is `FAILED`: error message, stack trace, compensation state).
- **Task Logs**: Filtered stream of logs specific to this node.

##### 5.3 Lossless Bidirectional Canonical JSON IR Converter (`workflow-ir-converter.ts`)
- Support serialization and deserialization of all 23 task types with their domain-specific properties.
- Execute graph cycle detection using Kahn's algorithm and Tarjan's Strongly Connected Components algorithm.
- Validate parameter reference bindings (`${workflow.input.*}`, `${taskRef.output.*}`).

##### 5.4 Implementation Steps Roadmap
- **Step 1**: Expand `DagNodeType` in `dag-node.tsx` to all 23 backend task types with dedicated category icons and badges.
- **Step 2**: Reorganize `dag-palette.tsx` into 5 collapsible categories with search filtering and default payloads.
- **Step 3**: Implement specialized property forms in `dag-property-inspector.tsx`.
- **Step 4**: Build `time-travel-scrubber.tsx` for playback control and timeline event scrubbing.
- **Step 5**: Build `task-telemetry-inspector.tsx` for read-only runtime payload and worker log inspection.
- **Step 6**: Wire modes and state synchronization in `visual-dag-studio.tsx`.
- **Step 7**: Update `workflow-ir-converter.ts` for all 23 node types.
- **Step 8**: Unit testing and automated verification.

---

### Phase 37: Human-in-the-Loop (HITL) Operations: Task Approval Inbox, Decision Modals & SLA Tracking

#### 1. Strategic Objective
Establish enterprise governance and human oversight workflows by implementing an end-to-end Human-in-the-Loop subsystem, complete with a dedicated Task Approval Inbox, interactive decision forms, claim mechanics, and SLA timeout escalation.

#### 2. Backend Human Task Architecture (`apps/backend/workflow-engine`)
- **Task Lifecycle Extensions**:
  - When the engine encounters a `HUMAN` node, `HumanNodeStrategy` schedules the task and sets status to `WAITING_FOR_APPROVAL`.
  - The workflow execution enters a graceful paused state waiting for task resolution.
  - A transactional outbox event `HUMAN_TASK_ASSIGNED` is emitted containing `assignmentRole`, `assignedUserId`, `dueDate`, and `payloadSnapshot`.
- **Claim & Resolve REST Endpoints (`WorkflowExecutionController` / `TaskWorkerController`)**:
  - `POST /api/v1/workflow/tasks/{id}/claim`:
    - Locks the human task to the authenticated user ID (`claimed_by = principal.getName()`, `claimed_at = now`).
    - Prevents duplicate or conflicting review actions by concurrent operators.
  - `POST /api/v1/workflow/tasks/{id}/unclaim`:
    - Releases the lock, returning the task to the pool for other authorized operators.
  - `POST /api/v1/workflow/tasks/{id}/resolve`:
    - Accepts payload: `{ action: "APPROVE" | "REJECT", comment: "...", formData: { ... } }`.
    - If `APPROVE`: Transitions task to `COMPLETED`, merges `formData` into task `outputData`, and evaluates downstream nodes.
    - If `REJECT`: Transitions task to `FAILED` with explicit rejection reason, triggering configured Saga compensation or alternative branch routing.
- **SLA & Escalation Policy**:
  - If `timeoutSeconds` expires before resolution, the background lease sweeper transitions the task to `TIMED_OUT` and either:
    1. Triggers an automatic fallback/escalation handler (`escalationHandlerRef`).
    2. Marks the workflow as `FAILED` with `HUMAN_SLA_BREACH`.

#### 3. Frontend Approval Inbox & Decision Modals (`apps/console`)
- **Dedicated Route / View (`/approvals` & `/tasks?tab=approvals`)**:
  - Filter tabs: **Pending My Review**, **Unassigned Queue**, **Completed / History**.
  - Priority badges with visual SLA countdown indicators:
    - Normal: Slate badge with countdown (e.g. `2h 15m remaining`).
    - Urgent (<30 mins): Amber pulsing badge.
    - Breached: Red badge (`SLA Breached`).
- **Interactive Decision Modal (`human-decision-modal.tsx`)**:
  - Left pane: Upstream execution context, requester identity, timestamp, and read-only data preview.
  - Right pane: Decision form containing:
    - Dynamic verification checkboxes defined by the workflow designer.
    - Decision rationale comment textarea (mandatory on rejection).
    - Clear action buttons: **Approve Workflow** (emerald green), **Reject & Terminate** (destructive red), **Request Additional Context**.
- **Real-Time Notification Integration**:
  - Navigation sidebar rail displays a live badge counter indicating pending human approvals.
  - Real-time SSE updates automatically add new approval tasks to the inbox without page refreshes.

---

### Phase 38: Enterprise Resilient Lease Queue, Poison DLQ & Priority Queuing

#### 1. Strategic Objective
Harden the single-column lease queue into a resilient, high-throughput, and fair multi-tenant task distribution engine capable of handling tens of thousands of concurrent tasks without head-of-line blocking or worker starvation.

#### 2. Poison Task Dead-Letter Queue (DLQ) Architecture
- **Problem**: When a worker encounters a poisoned task (e.g. invalid payload causing JVM OutOfMemoryError, syntax error, or unrecoverable external API crash), repeated retries block queue processing and exhaust worker threads.
- **DLQ Table Schema (`db/migration/V15__task_dlq.sql`)**:
  ```sql
  CREATE TABLE task_dlq (
      dlq_id VARCHAR(64) PRIMARY KEY,
      task_id VARCHAR(64) NOT NULL,
      workflow_id VARCHAR(64) NOT NULL,
      tenant_id VARCHAR(64) NOT NULL,
      workspace_id VARCHAR(64) NOT NULL,
      task_type VARCHAR(32) NOT NULL,
      domain VARCHAR(64) NOT NULL,
      error_message TEXT,
      error_stacktrace TEXT,
      payload_snapshot JSONB NOT NULL,
      retry_count INT NOT NULL,
      isolated_at_ms BIGINT NOT NULL,
      replayed_at_ms BIGINT,
      status VARCHAR(32) NOT NULL DEFAULT 'ISOLATED' -- ISOLATED, REPLAYED, DISCARDED
  );
  CREATE INDEX idx_task_dlq_tenant ON task_dlq(tenant_id, isolated_at_ms DESC);
  ```
- **Automated Isolation**:
  - In `WorkflowEngineService.reportTaskResult`, when a task fails and `attempt >= maxRetries` or is flagged as `FAILED_WITH_TERMINAL_ERROR`:
    - Move record from active `task_queue` to `task_dlq`.
    - Mark `task_executions` status as `FAILED`.
    - Trigger Saga reverse compensation for the parent workflow.
- **DLQ Management Endpoints**:
  - `GET /api/v1/workflow/dlq`: List isolated poison tasks with filtering by tenant and date range.
  - `POST /api/v1/workflow/dlq/{id}/replay`: Re-enqueue task into active queue with reset retry count and optional payload overrides.
  - `DELETE /api/v1/workflow/dlq/{id}`: Discard poison task and archive error logs.

#### 3. Priority-Based Multi-Tenant Fair Scheduling
- **Query Optimization**:
  ```sql
  SELECT task_id FROM task_queue 
  WHERE tenant_id = ? AND task_type = ? AND domain = ? AND visible_at_epoch_ms <= ?
  ORDER BY priority DESC, visible_at_epoch_ms ASC 
  LIMIT ? FOR UPDATE SKIP LOCKED
  ```
- **Tenant Tier Priority Mapping**:
  - `ENTERPRISE`: Priority 100 (Immediate dispatch, zero queue wait).
  - `PRO`: Priority 50 (Standard business dispatch).
  - `STANDARD`: Priority 10 (Background batch dispatch).
- **Anti-Starvation Starvation Guard**:
  - A dynamic priority aging function boosts priority of waiting tasks by +1 for every 5 seconds spent waiting in queue, guaranteeing low-priority tasks are never permanently starved.

#### 4. Anti-Thundering Herd & Distributed Heartbeat Drift
- **Jittered Backoff Algorithm**:
  ```text
  interval = min(maxBackoff, baseBackoff * (2 ^ attempt))
  jitter = random(0, interval * 0.2)
  sleepTime = interval + jitter
  ```
- **Distributed Lease Heartbeat Drift**:
  - Background sweeper running on a dedicated Java 21 Virtual Thread scans for tasks where:
    ```sql
    visible_at_epoch_ms < (now - 30000) AND lease_owner IS NOT NULL
    ```
  - Automatically reclaims the lease, increments `attempt`, and schedules immediate redispatch.

---

### Phase 39: Workflow Definition Versioning, Hot Migration Policies & Tamper-Evident Audit Ledger

#### 1. Strategic Objective
Enable continuous workflow schema evolution in enterprise production environments without downtime, providing safe in-flight execution migration and cryptographically verifiable audit trails for regulatory compliance.

#### 2. Semantic Definition Versioning
- **Lifecycle States**:
  - `DRAFT`: In authoring; can be modified in-place; cannot accept production executions.
  - `ACTIVE`: Published and immutable; receives all new execution requests.
  - `DEPRECATED`: In-flight executions complete normally; new executions rejected unless explicitly targeting this version.
  - `ARCHIVED`: Historical read-only record; cannot be executed.
- **Definition Storage Evolution**:
  - `UNIPOST_WORKFLOW_DEFINITIONS`:
    - `workflow_key` (e.g. `order-fulfillment`).
    - `version` (integer: `1`, `2`, `3`).
    - `status` (`DRAFT`, `ACTIVE`, `DEPRECATED`, `ARCHIVED`).
    - `published_at`, `published_by`.
    - Partial unique index: `UNIQUE(workflow_key, version)`.

#### 3. In-Flight Execution Migration Engine
- **Dual Migration Policies**:
  - **Policy A: Immutable Snapshot (Default)**:
    - Executions always execute against the serialized `definition_snapshot` recorded at startup. Zero risk of runtime regression.
  - **Policy B: Hot Migration (Operator-Driven)**:
    - Used during urgent bug fixes or business logic updates on long-running workflows (e.g. multi-week human approvals).
    - **Topological Graph Compatibility Validator**:
      - Verifies that all completed tasks in `v1` exist with compatible output schemas in `v2`.
      - Verifies that the current execution frontier can cleanly transition to downstream nodes in `v2`.
      - Rewires execution pointer to `v2` and records an audit migration event.

#### 4. Tamper-Evident Cryptographic Audit Ledger (`workflow_audit_log`)
- **Schema (`db/migration/V16__workflow_audit_log.sql`)**:
  ```sql
  CREATE TABLE workflow_audit_log (
      sequence_num BIGSERIAL PRIMARY KEY,
      event_id VARCHAR(64) NOT NULL UNIQUE,
      workflow_id VARCHAR(64) NOT NULL,
      tenant_id VARCHAR(64) NOT NULL,
      actor_id VARCHAR(64) NOT NULL, -- User ID, Worker ID, or 'SYSTEM'
      action VARCHAR(64) NOT NULL,   -- EXECUTION_STARTED, TASK_COMPLETED, HUMAN_APPROVED, SAGA_COMPENSATED
      payload_snapshot JSONB NOT NULL,
      prev_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of previous audit record
      current_hash VARCHAR(64) NOT NULL, -- SHA-256(prev_hash + event_id + action + payload_snapshot + timestamp)
      created_at_ms BIGINT NOT NULL
  );
  CREATE INDEX idx_audit_workflow ON workflow_audit_log(workflow_id, sequence_num ASC);
  ```
- **Integrity Verification Service**:
  - `AuditLedgerVerifier.verifyExecutionChain(workflowId)`:
    - Traverses all audit records from `sequence_num = 1` to present.
    - Recomputes SHA-256 hashes sequentially.
    - Detects any direct SQL edits or data tampering with cryptographic proof.
  - REST endpoint: `GET /api/v1/workflow/executions/{id}/audit/verify` returning `{ verified: true, totalEvents: 14 }` or `{ verified: false, corruptedAtSequence: 7 }`.

---

### Phase 40: Visual Time-Travel Execution Replay, Worker Fleet Telemetry & Chaos Verification

#### 1. Strategic Objective
Deliver unmatched operational transparency and debugging capabilities through an interactive visual time-travel scrubber, worker fleet health dashboard, and rigorous chaos engineering verification under extreme load.

#### 2. Visual Time-Travel Execution Replay (`VisualDagStudio`)
- **Interactive Scrubber Component (`execution-time-travel-scrubber.tsx`)**:
  - Mounted along the bottom edge of the Visual DAG Studio canvas during execution inspection mode.
  - Slider controls representing the discrete timeline of the workflow run from `T0` (start) to `T_final` (terminal state).
- **Microsecond State Projection**:
  - As the operator drags the scrubber slider:
    - Nodes dynamically illuminate according to their exact status at that millisecond (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`).
    - The bottom Execution Run Drawer updates to display the exact values of `snapshot.variables()` at that point in time.
    - Side-by-side JSON diff viewer highlights what changed between step `N` and `N+1`.
- **Fork & Re-run from Selected Node**:
  - When debugging a failed execution, the operator clicks any node on the canvas and selects **"Fork Execution from Here"**.
  - Opens a dialog allowing the operator to adjust input parameters or variables.
  - Triggers a new execution instance that copies the verified outputs of all prior nodes and resumes execution from the selected node forward.

#### 3. Polyglot Worker Fleet Dashboard (`/system/workers`)
- **Fleet Registry API (`GET /api/v1/workflow/workers`)**:
  - Returns registered worker processes across both Java Virtual Threads and `@unipost/worker` Node.js instances.
  - Telemetry attributes: `workerId`, `hostIp`, `runtime` (`JAVA_VIRTUAL_THREADS` vs `NODE_TYPESCRIPT`), `pollDomains`, `concurrencyLimit`, `activeLeases`, `heartbeatAgeMs`, `status` (`HEALTHY`, `DEGRADED`, `OFFLINE`).
- **Visual Fleet Monitoring Grid in Console**:
  - Liquid Glass cards displaying worker instances with live heartbeat status indicators.
  - Aggregate throughput meters: tasks processed per second, average lease duration, error rates per worker.

#### 4. Enterprise Chaos Engineering & Stress Verification
- **1,000-Concurrent Execution Stress Test**:
  - Automated test scenario generating 1,000 parallel order fulfillment workflows against PostgreSQL with real database persistence.
- **Chaos Injection Profiles**:
  1. **Worker Process Termination**: Randomly `kill -9` worker processes during active task execution; assert that the lease sweeper reclaims all orphaned tasks within 15 seconds with zero dropped executions.
  2. **Database Connection Drop**: Simulate transient PostgreSQL connection disconnects; assert that workers and deciders retry with exponential backoff and resume cleanly once the connection returns.
  3. **Cascading Saga Rollback**: Inject deliberate faults into downstream shipping nodes across 200 concurrent runs; assert that `SagaCompensator` successfully executes reverse compensation tasks (`cancel-shipping` $\to$ `release-inventory`) in strict reverse topological order for 100% of failed executions.

---

## 4. Architectural Invariants Summary

| # | Invariant | Description |
| :-: | :--- | :--- |
| **1** | **Zero-I/O Functional Decider Purity** | `PureDecider` in `core` remains strictly detached from Spring Boot, database drivers, and network I/O. All system tasks, human gates, and storage interactions execute in the imperative shell. |
| **2** | **Full 23-Node Bidirectional Canvas Fidelity** | Visual modifications (drag-drop, coordinate moves, parameter edits) across all 23 node types round-trip to Canonical JSON IR with 100% attribute preservation and zero layout loss. |
| **3** | **Cryptographic Audit Immutability** | Every workflow lifecycle transition is recorded in an append-only SHA-256 hash-chained ledger (`workflow_audit_log`), guaranteeing verifiable proof against database tampering. |
| **4** | **Starvation-Free Fair Distributed Leasing** | Task polling via `FOR UPDATE SKIP LOCKED` prioritizes enterprise tenants while utilizing anti-starvation dynamic priority aging for standard queues. |
| **5** | **Poison Task Quarantine (DLQ)** | Poison tasks exceeding `maxRetries` or experiencing terminal crashes are quarantined into `task_dlq`, preventing queue head-of-line blocking. |
| **6** | **Safe Definition Evolution (Memento + Hot Migration)** | In-flight workflows run on immutable Memento definition snapshots by default. Hot migration is permitted only when topological compatibility validation succeeds. |
| **7** | **Zero Synthetic Mocks in Verification** | All integration tests execute against real production classes, real database schemas, and actual network protocols without synthetic mock shortcuts. |

---

## 5. Enterprise Quality, Resilience & Verification Strategy

### Automated Verification Pipeline

1. **Backend Maven Reactor Test Suite**:
   ```powershell
   cd apps/backend; ./mvnw.cmd clean test '-Dsurefire.failIfNoSpecifiedTests=false'
   ```
   - `workflow-engine`: 100% unit test coverage over `PureDecider`, `NodeStrategyRegistry`, `ParameterResolver`, `SagaCompensator`, and `AuditLedgerVerifier`.
   - `unipost-ms-aio`: Spring Boot integration tests verifying definition versioning, human task endpoints, DLQ management, and SSE telemetry.

2. **Pure TypeScript Worker SDK Test Suite**:
   ```powershell
   pnpm --filter @unipost/worker test
   ```
   - Assert adaptive polling, concurrency limiters, auto-heartbeat middleware, and reverse Saga execution.

3. **Console UI & Unified Sandbox Test Suite**:
   ```powershell
   pnpm --filter @unipost/console test
   pnpm --filter @unipost/sandbox test
   ```
   - Assert visual palette rendering for all 23 node types, property inspector form bindings, time-travel scrubber interactions, and offline sandbox decider simulation.

4. **Production Build Integrity**:
   ```powershell
   pnpm build
   ```
   - Guarantee zero TypeScript errors and zero packaging regressions across all monorepo workspaces.
