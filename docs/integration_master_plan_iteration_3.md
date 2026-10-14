# Integration Master Plan (Iteration 3)
## Workstream 6: Battle-Tested Distributed DAG & Workflow Orchestration Engine (Conductor OSS & Local-First Architecture)

---

## 1. Executive Summary & Architectural Vision

Iteration 3 advances the UniPost platform from metadata-driven data persistence and visual state machines to a **battle-tested, distributed Workflow Orchestration Engine**. Drawing architectural patterns directly from **Netflix Conductor OSS** and modern **Local-First / Hexagonal Systems**, this engine delivers deterministic execution, zero-loss snapshot isolation, and unified multi-cloud/local deployment capabilities.

While State Machines (FSM) govern lifecycle state transitions on individual aggregate entities (e.g. `DRAFT -> SUBMITTED -> APPROVED`), enterprise operations require high-throughput multi-step orchestration across distributed systems: parallel task fan-out/fan-in, conditional evaluation, dynamic loops, async callback deferral, distributed worker leasing, automated compensation (Sagas), and zero-I/O deterministic decider loops.

Iteration 3 bridges **code-first developer authoring** with **zero-code visual builder authoring** via a bidirectional **Canonical Intermediate Representation (IR)**. The engine is organized around **Hexagonal Architecture (Ports & Adapters)**, separating a 100% deterministic, zero-I/O functional core (`PureDecider`) from pluggable imperative persistence and worker transport adapters.

```
       +-------------------------------------------------------+
       |               Authoring Interfaces                    |
       |                                                       |
       |   [ Developer IDE ]            [ Web Canvas (React Flow) ]
       |   Java Fluent DSL              Visual Workflow Studio |
       |   (.builder().build())         (Drag, Drop, Connect)  |
       +---------------------------+---------------------------+
                                   |
                                   v
       +-------------------------------------------------------+
       |       Canonical Workflow Intermediate Representation   |
       |                       (IR / JSONB)                    |
       |   - nodes: Task key, handlerRef, timeout, retries     |
       |   - nodeTypes: SIMPLE, SWITCH, FORK_JOIN, WAIT, etc.  |
       |   - layoutMetadata: (x, y) coordinates & zoom         |
       +---------------------------+---------------------------+
                                   |
                Topological Sorter & Acyclicity Verifier
                       (Kahn's Algorithm + Tarjan)
                                   |
                                   v
       +-------------------------------------------------------+
       |             PureDecider (Zero-I/O Core)               |
       |   - 100% Pure & Deterministic State Machine Evaluator |
       |   - Strategy Pattern per Node Type                    |
       |   - Emits Sealed Engine Commands                      |
       +---------------------------+---------------------------+
                                   |
                     UnitOfWork & Storage Adapters
         (PostgreSQL RLS SKIP LOCKED / SQLite WAL Local-First)
                                   |
                                   v
       +-------------------------------------------------------+
       |       Single-Column Lease Queue (task_queue)          |
       |   - visible_at_epoch_ms governs schedule, lease,      |
       |     async callback deferrals, and retry backoffs      |
       +---------------------------+---------------------------+
                                   |
               Pull-Based Worker Transport (In-Process / HTTP)
                                   |
                                   v
       +-------------------------------------------------------+
       |     Virtual-Thread Conductor Worker SDK & Host        |
       |   - Semaphore-governed max concurrency per task type  |
       |   - Composable Middleware: Heartbeat, Validation, Err |
       |   - TaskOutcome: Completed, InProgress, Failed        |
       +-------------------------------------------------------+
```

---

## 2. Core Architectural Invariants (Non-Negotiable)

1. **Zero-I/O Functional Core (`PureDecider`)**:
   - Everything under the core engine package MUST be 100% pure, deterministic, and synchronous.
   - Core classes must NEVER import `java.sql.*`, network clients, thread pools, Spring beans, or call `System.currentTimeMillis()` / `Instant.now()` / `UUID.randomUUID()` directly. Explicit parameters (`long nowEpochMs`, deterministic IDs) must be passed in.
   - Signature: `DecisionResult decide(WorkflowDefinition definition, WorkflowSnapshot snapshot, long nowEpochMs)`.
2. **Memento Pattern for Definition Immutability**:
   - Starting a workflow MUST freeze a serialized JSON snapshot of the `WorkflowDefinition` into the persisted execution record (`definition_snapshot`). In-flight workflows evaluate strictly against their frozen definition, immunizing running jobs from schema mutations.
3. **Open/Closed Node Evaluation (`Strategy + Registry Pattern`)**:
   - No monolithic `switch/if-else` blocks inside `PureDecider`.
   - Every node type (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `DO_WHILE`, `WAIT`) implements `NodeEvaluatorStrategy` registered in `NodeStrategyRegistry`.
4. **Transactional Outbox + Single-Column Lease Queue (`Unit of Work`)**:
   - State updates and queue scheduling occur inside a single atomic transaction (`UnitOfWork`).
   - Relational `task_queue` outbox table uses a single unified `visible_at_epoch_ms` column governing initial scheduling (`now`), worker lease lock (`now + responseTimeoutMs`), async deferral (`now + callbackAfterMs`), and exponential retry backoff (`now + backoffMs`).
   - Supports PostgreSQL `FOR UPDATE SKIP LOCKED` for cloud-native clusters and SQLite WAL mode for local-first/desktop execution. Zero external broker dependency (no mandatory Kafka/Redis/RabbitMQ).
5. **Stateless Polling Workers with Virtual Threads & Middleware Chain**:
   - Pull-based `WorkerTransportPort` (`pollBatch`, `reportTaskResult`, `heartbeat`) executed by `WorkerHost` using Java 21 Virtual Threads and `java.util.concurrent.Semaphore` concurrency controls.
   - Execution runs through composable middleware:
     - `SchemaValidationMiddleware` (validates task input/output contracts)
     - `AutoHeartbeatMiddleware` (periodically extends lease timestamp in background during long operations)
     - `ErrorClassificationMiddleware` (differentiates transient retryable errors from terminal failures).
6. **Multi-Tenant RLS & Sovereign Context Preservation**:
   - All workflow definition, execution, and task queue records strictly partition by `tenant_id` and `workspace_id`.
   - W3C traceparent context (`trace_id`, `tenant_id`, `workspace_id`, `task_id`) propagates through every decider step, worker execution log, and outbox event.
7. **Zero-Synthetic-Mocks & Active Runtime Execution Invariant**:
   - In accordance with monorepo rules, tests must exercise real production classes, real SQLite/PostgreSQL schemas, and real deciders. Golden trace replay suites guarantee zero regressions.

---

## 3. Iteration 3 Scope & Phase Breakdown (Phases 26 – 30)

| Phase | Milestone Title | Target Deliverables | Verification Mechanism |
| :---: | :--- | :--- | :--- |
| **Phase 26** | **Canonical Workflow IR, Memento Snapshots & Zero-I/O PureDecider** | Canonical JSON schema (`workflow-ir-schema-v1.json`), Memento snapshot serialization, Java 21 sealed `EngineCommand`s, immutable domain models, and pure deterministic state machine decider core. | Pure JUnit 5 record-in / command-out unit test suite executing in <1ms without mocks or Spring context. |
| **Phase 27** | **Conductor Node Strategies, Topological Frontiers & Parameter Resolver** | Open/Closed `NodeStrategyRegistry` implementing `SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, and `DO_WHILE` strategies; Kahn's algorithm topological frontier discovery; Tarjan cycle detection; JSONPath / SpEL `ParameterResolver`. | Cycle detection tests asserting cycle path traces; parameter resolution tests evaluating `${workflow.input.*}` and `${taskRef.output.*}`; branch resolution tests. |
| **Phase 28** | **Hexagonal Engine, Single-Column Lease Queue & Storage Adapters** | Hexagonal ports (`PersistencePort`, `UnitOfWork`, `WorkerTransportPort`); `WorkflowEngineService`; atomic single-column lease queue with `visible_at_epoch_ms`; dual storage adapters (`PostgresJdbcPersistenceAdapter` with RLS/SKIP LOCKED and `SqliteJdbcPersistenceAdapter` with WAL mode); lease sweeper for automatic timeout recovery. | Multi-threaded lease contention contract test suite run against both SQLite WAL and PostgreSQL Testcontainers; worker crash lease recovery test. |
| **Phase 29** | **Virtual-Thread Worker SDK, Middleware Chain & Distributed Saga Compensation** | Conductor-style worker contract (`TaskContext`, `TaskOutcome`, `TaskHandler`); `WorkerHost` with virtual threads and adaptive backoff; composable middleware chain (`AutoHeartbeatMiddleware`, `SchemaValidationMiddleware`); reverse topological Saga compensator with rollback audit trails. | Automated worker test suite verifying heartbeats extending leases, `TaskOutcome.inProgress` deferrals, retry backoffs, and reverse Saga compensation traversal on terminal failures. |
| **Phase 30** | **Visual React Flow Studio, Unified Sandbox Simulator & Chaos Replay Suite** | Visual Workflow Studio in `@unipost/console` with custom Conductor nodes (`SWITCH`, `FORK_JOIN`, `WAIT`); live execution overlay; Unified Sandbox platform workflow adapter; Golden Trace Replay regression suite (100 concurrent chaos runs with random task failures). | Vitest component tests in `@unipost/console`; Golden trace replay suite verifying 100% deterministic state reproduction; full production build pass. |

---

## 4. Deep Dive Phase Specifications

### Phase 26: Canonical Workflow IR, Memento Snapshots & Zero-I/O PureDecider
- **Objective:** Establish the non-lossy workflow IR schema, immutable Memento snapshotting, and the pure deterministic decider core without any I/O side effects.
- **Canonical IR Specifications (`workflow-ir-schema-v1.json`)**:
  - `workflowKey`: Alphanumeric slug identifier (e.g. `order-fulfillment-pipeline`).
  - `version`: Monotonically increasing schema revision integer.
  - `tasks`: Array of workflow tasks with `taskReferenceName`, `taskType` (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `WAIT`, etc.), `inputParameters`, `timeoutSeconds`, `retryCount`, `retryDelaySeconds`, and `backoffRate`.
  - `layoutMetadata`: Canvas coordinates (`x`, `y`) and layout node state for round-trip fidelity between visual builder and code DSL.
- **Deterministic Domain Models**:
  - `WorkflowDefinition`, `WorkflowSnapshot`, `TaskSnapshot`, `TaskStatus` (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMED_OUT`, `SKIPPED`), `WorkflowStatus` (`RUNNING`, `COMPLETED`, `FAILED`, `TERMINATED`, `PAUSED`).
- **Sealed Engine Commands (`EngineCommand.java`)**:
  - `ScheduleTask(taskId, taskType, referenceName, domain, input, attempt, visibleAtEpochMs, responseTimeoutMs)`
  - `UpdateTaskStatus(taskId, referenceName, status, output, error)`
  - `DeferTaskCallback(taskId, referenceName, visibleAtEpochMs, output)`
  - `TransitionWorkflow(status, output, reason)`
- **Zero-I/O `PureDecider`**:
  - Implements `DecisionResult decide(WorkflowDefinition definition, WorkflowSnapshot snapshot, long nowEpochMs)`.
  - Zero imports of `java.sql.*`, `Instant.now()`, or external frameworks.

### Phase 27: Conductor Node Strategies, Topological Frontiers & Parameter Resolver
- **Objective:** Provide extensible task evaluation strategies supporting Conductor-grade workflow graphs, topological acyclicity enforcement, and flexible parameter resolution.
- **Node Evaluator Strategies (`NodeEvaluatorStrategy`)**:
  - `SimpleTaskStrategy`: Handles basic worker task dispatch, retry policy calculations (exponential/fixed backoff), and terminal error transitions.
  - `SwitchNodeStrategy`: Evaluates dynamic condition expressions against `decisionCases` and schedules matching branch tasks or `defaultCase`.
  - `ForkJoinStrategy`: Concurrently schedules parallel branch lists and enforces a synchronization barrier at the `JOIN` node until all required branches reach `COMPLETED`.
  - `DynamicForkStrategy`: Dynamically spins up parallel task instances based on a runtime array payload.
  - `WaitNodeStrategy`: Pauses execution until an absolute epoch timestamp or external signal/webhook resume command.
  - `DoWhileStrategy`: Evaluates loop conditions, maintaining loop iteration indices and guarding against infinite loops with a max iteration ceiling.
- **Topological & Cycle Guard Engine**:
  - Kahn's algorithm verifies graph acyclicity upon workflow registration/update.
  - Tarjan's strongly connected components algorithm extracts explicit cycle path traces upon cycle detection.
- **Parameter Resolution (`ParameterResolver`)**:
  - Resolves `${workflow.input.x}` and `${<taskRef>.output.y}` paths across nested JSON structures and arrays prior to task scheduling.

### Phase 28: Hexagonal Engine, Single-Column Lease Queue & Storage Adapters
- **Objective:** Build the imperative shell, transactional outbox queue, and dual storage adapters for cloud-native and local-first environments.
- **Relational Hybrid Schema**:
  - `workflow_executions`: Stores `workflow_id`, `tenant_id`, `workspace_id`, `status`, `definition_snapshot` (frozen Memento JSON), `input_payload`, `output_payload`, `failure_reason`, `created_at_ms`, `updated_at_ms`.
  - `task_executions`: Stores `task_id`, `workflow_id`, `reference_name`, `task_type`, `domain`, `status`, `attempt`, `worker_id`, `input_payload`, `output_payload`, `task_logs`, `response_timeout_ms`.
  - `task_queue`: Unified outbox queue with `task_id`, `workflow_id`, `task_type`, `domain`, `priority`, `visible_at_epoch_ms`, `lease_owner`.
- **Single-Column Lease Mechanism**:
  - Atomic poll via `SELECT ... WHERE task_type = ? AND domain = ? AND visible_at_epoch_ms <= ? ORDER BY priority DESC, visible_at_epoch_ms ASC LIMIT ? FOR UPDATE SKIP LOCKED` (or SQLite indexed query in WAL mode).
  - Atomically sets `visible_at_epoch_ms = now + responseTimeoutMs` and assigns `lease_owner`.
- **Hexagonal Ports & Storage Adapters**:
  - `PersistencePort` & `UnitOfWork` contracts.
  - `PostgresJdbcPersistenceAdapter`: Multi-tenant RLS-aware PostgreSQL adapter with `FOR UPDATE SKIP LOCKED`.
  - `SqliteJdbcPersistenceAdapter`: Zero-dependency, file-based/in-memory SQLite adapter with WAL mode enabled for local-first/desktop.
  - `InMemoryPersistenceAdapter`: Thread-safe in-memory adapter for unit testing.
- **Imperative Shell (`WorkflowEngineService`)**:
  - Orchestrates transactions, triggers `PureDecider`, and runs background lease sweeping (`sweepExpiredTasks`) to detect hung workers and re-queue timed-out tasks.

### Phase 29: Virtual-Thread Worker SDK, Middleware Chain & Distributed Saga Compensation
- **Objective:** Provide a high-ergonomics worker runtime matching Netflix Conductor, leveraging Java 21 Virtual Threads, automatic heartbeating, and reverse Saga compensation.
- **Worker SDK Contracts**:
  - `TaskContext`: Typed input binding (`bindInput(Class<T>)`), contextual logging (`log(message)`), and explicit heartbeat triggers.
  - `TaskOutcome`: Sealed records for `Completed(output)`, `InProgress(callbackAfterSeconds, partialOutput)`, and `Failed(errorMessage, retryable)`.
  - `TaskHandler`: Functional interface `TaskOutcome execute(TaskContext context) throws Exception;`.
- **Worker Host & Middleware Pipeline (`WorkerHost`)**:
  - Virtual thread execution via `Executors.newVirtualThreadPerTaskExecutor()`.
  - Per-task-type concurrency limits enforced by `Semaphore(maxConcurrency)`.
  - Adaptive backoff: instantaneous draining (`0ms` delay) when tasks are found, scaling exponentially up to `maxPollIntervalMs` when queues are idle.
  - Middleware Chain:
    - `SchemaValidationMiddleware`: Invariant checking on task inputs/outputs.
    - `AutoHeartbeatMiddleware`: Background virtual thread periodically extending the lease timestamp on `task_queue` while long-running jobs process.
    - `ErrorClassificationMiddleware`: Maps uncaught exceptions to retryable or terminal failure outcomes.
- **Distributed Saga Compensation**:
  - On unrecoverable task failure, the engine computes the reverse topological execution path of all completed tasks with registered `compensateHandlerRef` actions.
  - Sequentially dispatches compensation tasks to rollback side-effects with full MDC execution auditing.

### Phase 30: Visual React Flow Studio, Unified Sandbox Simulator & Chaos Replay Suite
- **Objective:** Provide visual workflow modeling in `@unipost/console`, seamless local simulation via the Unified Sandbox Platform, and full chaos verification.
- **Visual Workflow Studio (`@unipost/console`)**:
  - Expand React Flow canvas architecture to support the full Conductor node catalog (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `WAIT`, `DO_WHILE`).
  - Interactive property inspectors for input bindings, retry backoffs, and condition expressions.
  - Live execution monitoring overlay: nodes dynamically color-coded by execution state (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMED_OUT`) with real-time log drawer.
  - Dagre auto-layout with animated layout transitions.
- **Unified Sandbox Engine Integration (`@unipost/sandbox`)**:
  - Implement `workflowSandboxHandler` registered in `sandboxRegistry`.
  - In-memory simulation of decider cycles, task leases, and mock worker polling.
  - Zero network mocks; full integration with `SandboxDock` state resets and active tenant switching.
- **Chaos Verification & Golden Trace Replay Suite**:
  - `GoldenTraceReplayTest.java`: Replays historical execution traces against `PureDecider` verifying deterministic outputs.
  - Chaos integration test running 100 concurrent workflow executions with simulated random worker terminations, network partitions, and lease expiration recoveries.

---

## 5. Architectural Invariants Summary

| # | Invariant | Description |
| :-: | :--- | :--- |
| **1** | **Zero-I/O Functional Core** | `PureDecider` is 100% pure and deterministic. No I/O, no system clocks, no network calls. |
| **2** | **Memento Immutability** | `definition_snapshot` freezes workflow JSON at start time. Running executions are immune to schema drift. |
| **3** | **Single-Column Lease Queue** | `visible_at_epoch_ms` governs dispatch, lease locks, async callbacks, and retry backoff. |
| **4** | **Transactional Outbox** | State transitions and queue events commit inside the exact same `UnitOfWork` database transaction. |
| **5** | **Zero-Loss Visual Round-Trip** | Visual builder edits and code DSL preserve all node attributes and `layoutMetadata` coordinates. |
| **6** | **Zero Synthetic Mocks** | Production classes, real SQLite WAL/PostgreSQL schemas, and real deciders are tested without artificial test doubles. |
| **7** | **Multi-Tenant Context** | Every workflow, execution, task, and log is strictly partitioned by `tenant_id` and `workspace_id`. |
