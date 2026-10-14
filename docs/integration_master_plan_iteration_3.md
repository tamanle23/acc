# Integration Master Plan (Iteration 3)
## Workstream 6: Battle-Tested Distributed Workflow Orchestration Engine (Netflix Conductor OSS & Local-First Architecture)

---

## 1. Executive Summary & Architectural Vision

Iteration 3 advances the UniPost platform from metadata-driven data persistence and visual state machines to a **battle-tested, distributed Workflow Orchestration Engine**. Drawing architectural patterns directly from **Netflix Conductor OSS** and modern **Local-First / Hexagonal Systems**, this engine delivers deterministic execution, zero-loss snapshot isolation, and unified multi-cloud/local deployment capabilities.

While State Machines (FSM) govern lifecycle state transitions on individual aggregate entities (e.g. `DRAFT -> SUBMITTED -> APPROVED`), enterprise operations require high-throughput multi-step orchestration across distributed systems:
- Parallel task fan-out and synchronization barriers (`FORK_JOIN`, `DYNAMIC_FORK`)
- Conditional branching (`SWITCH`) and deterministic loops (`DO_WHILE`)
- Asynchronous callback deferral (`WAIT`, `callbackAfterSeconds`)
- Relational lease queueing with auto-heartbeat lease extensions
- Automated compensating actions (Distributed Sagas)
- Zero-I/O deterministic decider loops

The engine is implemented as a dedicated Maven submodule (`workflow-engine`) within `apps/backend/` and organized around **Hexagonal Architecture (Ports & Adapters)**, strictly separating a 100% deterministic, zero-I/O functional core (`PureDecider`) from pluggable imperative persistence and worker transport adapters. It bridges **code-first developer authoring** with **zero-code visual builder authoring** (`@xyflow/react` in `@unipost/console`) via a bidirectional **Canonical Intermediate Representation (IR)**.

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

## 2. Non-Negotiable Architectural Invariants (Guardrails)

1. **Zero-I/O Functional Core (`PureDecider`)**:
   - Everything under the core engine package MUST be 100% pure, deterministic, and synchronous.
   - Core classes must NEVER import `java.sql.*`, `javax.sql.*`, network clients, thread pools, Spring annotations, or call `System.currentTimeMillis()` / `Instant.now()` / `UUID.randomUUID()` directly. Pass `long nowEpochMs` and deterministic task IDs explicitly.
   - Core signature: `DecisionResult decide(WorkflowDefinition definition, WorkflowSnapshot snapshot, long nowEpochMs)`.
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

## 3. Submodule Layout: `apps/backend/workflow-engine/`

```text
apps/backend/
├── pom.xml                                              # Root Backend POM (includes <module>workflow-engine</module>)
└── workflow-engine/                                     # NEW SUBMODULE
    ├── pom.xml                                          # Submodule POM (Jackson, SQLite-JDBC, SLF4J, JUnit 5, AssertJ)
    └── src/
        ├── main/
        │   ├── java/com/unipost/workflow/
        │   │   ├── core/                                # PURE DOMAIN CORE (Zero I/O, Zero JDBC/Framework imports)
        │   │   │   ├── model/
        │   │   │   │   ├── WorkflowDefinition.java      # Immutable Java records for DAG nodes & workflow def
        │   │   │   │   ├── WorkflowSnapshot.java        # Immutable point-in-time state of workflow + tasks
        │   │   │   │   ├── TaskSnapshot.java
        │   │   │   │   ├── TaskStatus.java              # Enum: SCHEDULED, IN_PROGRESS, COMPLETED, FAILED, TIMED_OUT, SKIPPED
        │   │   │   │   ├── WorkflowStatus.java          # Enum: RUNNING, COMPLETED, FAILED, TERMINATED, PAUSED
        │   │   │   │   ├── EngineCommand.java           # Sealed interface for deterministic engine commands
        │   │   │   │   └── DecisionResult.java
        │   │   │   ├── decider/
        │   │   │   │   ├── PureDecider.java             # Deterministic state machine evaluator
        │   │   │   │   ├── NodeStrategyRegistry.java
        │   │   │   │   └── strategy/
        │   │   │   │       ├── NodeEvaluatorStrategy.java
        │   │   │   │       ├── SimpleTaskStrategy.java
        │   │   │   │       ├── SwitchNodeStrategy.java
        │   │   │   │       ├── ForkJoinStrategy.java
        │   │   │   │       ├── DynamicForkStrategy.java
        │   │   │   │       ├── WaitNodeStrategy.java
        │   │   │   │       └── DoWhileStrategy.java
        │   │   │   └── expression/
        │   │   │       └── ParameterResolver.java       # Interpreter pattern for ${workflow.input.x} & ${taskRef.output.y}
        │   │   ├── ports/                               # HEXAGONAL PORTS (Interfaces only)
        │   │   │   ├── PersistencePort.java
        │   │   │   ├── UnitOfWork.java
        │   │   │   └── WorkerTransportPort.java         # pollBatch, reportTaskResult, heartbeat
        │   │   ├── application/                         # IMPERATIVE SHELL (Orchestrates UoW + PureDecider)
        │   │   │   ├── WorkflowEngineService.java       # startWorkflow, reportTaskResult, sweepExpiredLeases
        │   │   │   └── SagaCompensator.java             # Reverse-DAG compensation planner on terminal failure
        │   │   ├── adapters/                            # INFRASTRUCTURE ADAPTERS
        │   │   │   ├── storage/
        │   │   │   │   ├── InMemoryPersistenceAdapter.java
        │   │   │   │   ├── SqliteJdbcPersistenceAdapter.java # Pure JDBC + SQLite WAL mode (Local-First)
        │   │   │   │   └── PostgresJdbcPersistenceAdapter.java # PostgreSQL RLS + FOR UPDATE SKIP LOCKED
        │   │   │   └── transport/
        │   │   │       └── InProcessTransportAdapter.java
        │   │   └── worker/                              # WORKER SDK & MIDDLEWARE PIPELINE
        │   │       ├── WorkerHost.java                  # Virtual-thread poller, Semaphore concurrency & adaptive backoff
        │   │       ├── WorkerConfig.java                # Record for taskType, domain, concurrency, poll intervals
        │   │       ├── TaskContext.java                 # Context passed to worker handler (input, attempt, heartbeat, log)
        │   │       ├── TaskOutcome.java                 # Sealed return type (Completed, InProgress, Failed)
        │   │       ├── TaskHandler.java                 # Functional interface for worker tasks
        │   │       ├── WorkerMiddleware.java            # Chain of Responsibility interface & pipeline
        │   │       └── middleware/
        │   │           ├── SchemaValidationMiddleware.java
        │   │           ├── AutoHeartbeatMiddleware.java
        │   │           └── ErrorClassificationMiddleware.java
        │   └── resources/
        │       └── db/
        │           ├── schema-sqlite.sql                # DDL for workflow_executions, task_executions, task_queue
        │           └── schema-postgres.sql              # PostgreSQL DDL with RLS & SKIP LOCKED indexes
        └── test/
            └── java/com/unipost/workflow/
                ├── core/
                │   ├── PureDeciderTest.java             # Pure record-in / command-out unit tests (<1ms per test)
                │   └── GoldenTraceReplayTest.java       # Golden trace replay regression suite
                ├── adapters/
                │   ├── PersistenceContractTest.java     # Abstract JUnit 5 contract suite
                │   ├── InMemoryPersistenceTest.java     # Runs contract suite against InMemory adapter
                │   └── SqlitePersistenceTest.java       # Runs contract suite against SQLite WAL adapter
                └── e2e/
                    └── WorkflowLifecycleE2ETest.java    # End-to-end: retries, callbackAfterSeconds, lease recovery
```

---

## 4. Core Domain Contracts & Data Structures

### 4.1 Sealed Interface Commands (`EngineCommand.java`)
Java 21 `sealed interface` and `record` types model all side-effects requested by `PureDecider`:
```java
package com.unipost.workflow.core.model;

import java.util.Map;

public sealed interface EngineCommand permits
    EngineCommand.ScheduleTask,
    EngineCommand.UpdateTaskStatus,
    EngineCommand.DeferTaskCallback,
    EngineCommand.TransitionWorkflow {

    record ScheduleTask(
        String taskId,
        String taskType,
        String referenceName,
        String domain,
        Map<String, Object> input,
        int attempt,
        long visibleAtEpochMs,
        long responseTimeoutMs
    ) implements EngineCommand {}

    record UpdateTaskStatus(
        String taskId,
        String referenceName,
        TaskStatus status,
        Map<String, Object> output,
        String error
    ) implements EngineCommand {}

    record DeferTaskCallback(
        String taskId,
        String referenceName,
        long visibleAtEpochMs,
        Map<String, Object> output
    ) implements EngineCommand {}

    record TransitionWorkflow(
        WorkflowStatus status,
        Map<String, Object> output,
        String reason
    ) implements EngineCommand {}
}
```

### 4.2 Relational Hybrid Schema (`schema-sqlite.sql` & `schema-postgres.sql`)
```sql
CREATE TABLE IF NOT EXISTS workflow_executions (
  workflow_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'system',
  workspace_id TEXT NOT NULL DEFAULT 'default',
  workflow_name TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  definition_snapshot TEXT NOT NULL, -- Frozen JSON WorkflowDefinition (Memento)
  input_payload TEXT NOT NULL,       -- JSON
  output_payload TEXT,               -- JSON
  failure_reason TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_executions (
  task_id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'system',
  workspace_id TEXT NOT NULL DEFAULT 'default',
  reference_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  worker_id TEXT,
  input_payload TEXT NOT NULL,       -- JSON
  output_payload TEXT,               -- JSON
  error_details TEXT,
  task_logs TEXT,                    -- JSON array of timestamped worker logs
  response_timeout_ms INTEGER NOT NULL DEFAULT 30000,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflow_executions(workflow_id)
);

CREATE TABLE IF NOT EXISTS task_queue (
  task_id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'system',
  workspace_id TEXT NOT NULL DEFAULT 'default',
  task_type TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'default',
  priority INTEGER NOT NULL DEFAULT 0,
  visible_at_epoch_ms INTEGER NOT NULL,
  lease_owner TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_poll 
  ON task_queue (tenant_id, task_type, domain, visible_at_epoch_ms, priority DESC);
```

### 4.3 Atomic Queue Polling & Lease Acquisition
When a worker polls for up to `batchSize` tasks of `taskType` in `domain` at `nowMs`:
1. Inside an explicit transaction, select eligible `task_id` rows where `tenant_id = ? AND task_type = ? AND domain = ? AND visible_at_epoch_ms <= ?` ordered by `priority DESC, visible_at_epoch_ms ASC LIMIT ?` (using `FOR UPDATE SKIP LOCKED` in PostgreSQL or indexed transaction in SQLite).
2. Atomically update `task_queue` (`SET visible_at_epoch_ms = nowMs + response_timeout_ms, lease_owner = workerId`) and `task_executions` (`SET status = 'IN_PROGRESS', worker_id = workerId, updated_at_ms = nowMs`).
3. Commit transaction and return hydrated task payloads to worker.

### 4.4 Worker Contract & Developer Ergonomics (`worker/`)

```java
package com.unipost.workflow.worker;

import java.util.List;
import java.util.Map;

public interface TaskContext {
    String taskId();
    String workflowId();
    String tenantId();
    String workspaceId();
    String taskType();
    String referenceName();
    String domain();
    int attempt();
    Map<String, Object> input();
    <T> T bindInput(Class<T> type); // Jackson conversion helper
    void log(String message);       // Appends timestamped log to task execution
    List<String> logs();
    void heartbeat();               // Manual lease extension trigger
}

public sealed interface TaskOutcome permits
    TaskOutcome.Completed,
    TaskOutcome.InProgress,
    TaskOutcome.Failed {

    record Completed(Map<String, Object> output) implements TaskOutcome {}

    /** Returns task to queue invisible for callbackAfterSeconds without consuming a retry attempt */
    record InProgress(long callbackAfterSeconds, Map<String, Object> partialOutput) implements TaskOutcome {}

    /** Explicit failure control: retryable=false maps to FAILED_WITH_TERMINAL_ERROR */
    record Failed(String errorMessage, boolean retryable, Map<String, Object> output) implements TaskOutcome {}

    static TaskOutcome completed(Map<String, Object> output) {
        return new Completed(output != null ? output : Map.of());
    }
    static TaskOutcome inProgress(long callbackAfterSeconds, Map<String, Object> partialOutput) {
        return new InProgress(callbackAfterSeconds, partialOutput != null ? partialOutput : Map.of());
    }
    static TaskOutcome failedRetryable(String reason) {
        return new Failed(reason, true, Map.of());
    }
    static TaskOutcome failedTerminal(String reason) {
        return new Failed(reason, false, Map.of());
    }
}

@FunctionalInterface
public interface TaskHandler {
    TaskOutcome execute(TaskContext context) throws Exception;
}

public record WorkerConfig(
    String taskType,
    String domain,
    int maxConcurrency,
    long basePollIntervalMs,
    long maxPollIntervalMs,
    int pollBatchSize
) {
    public static WorkerConfig defaults(String taskType) {
        return new WorkerConfig(taskType, "default", 10, 50L, 2000L, 5);
    }
}
```

---

## 5. Iteration 3 Scope & Phase Breakdown (Phases 26 – 30)

| Phase | Milestone Title | Target Deliverables | Verification Mechanism |
| :---: | :--- | :--- | :--- |
| **Phase 26** | **Submodule Setup, Canonical Workflow IR & Zero-I/O PureDecider** | `apps/backend/workflow-engine` POM, `workflow-ir-schema-v1.json`, Memento snapshots, sealed `EngineCommand`s, immutable models, pure state machine decider core. | Pure JUnit 5 record-in / command-out unit test suite executing in <1ms without mocks or Spring context. |
| **Phase 27** | **Conductor Node Strategies, Topological Frontiers & Parameter Resolver** | `NodeStrategyRegistry` implementing `SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, and `DO_WHILE`; Kahn's topological frontier calculation; Tarjan cycle detection; JSONPath / SpEL `ParameterResolver`. | Cycle detection tests asserting cycle path traces; parameter resolution tests evaluating `${workflow.input.*}` and `${taskRef.output.*}`; branch resolution tests. |
| **Phase 28** | **Hexagonal Engine, Single-Column Lease Queue & Storage Adapters** | Hexagonal ports (`PersistencePort`, `UnitOfWork`, `WorkerTransportPort`); `WorkflowEngineService`; atomic single-column lease queue (`visible_at_epoch_ms`); dual storage adapters (`PostgresJdbcPersistenceAdapter` with RLS/SKIP LOCKED and `SqliteJdbcPersistenceAdapter` with WAL mode); lease sweeper for automatic timeout recovery. | Multi-threaded lease contention contract test suite run against both SQLite WAL and PostgreSQL Testcontainers; worker crash lease recovery test. |
| **Phase 29** | **Virtual-Thread Worker SDK, Middleware Chain & Distributed Saga Compensation** | Conductor-style worker contract (`TaskContext`, `TaskOutcome`, `TaskHandler`); `WorkerHost` with virtual threads and adaptive backoff; composable middleware chain (`AutoHeartbeatMiddleware`, `SchemaValidationMiddleware`); reverse topological Saga compensator with rollback audit trails. | Automated worker test suite verifying heartbeats extending leases, `TaskOutcome.inProgress` deferrals, retry backoffs, and reverse Saga compensation traversal on terminal failures. |
| **Phase 30** | **Visual React Flow Studio, Unified Sandbox Simulator & Chaos Replay Suite** | Visual Workflow Studio in `@unipost/console` with custom Conductor nodes (`SWITCH`, `FORK_JOIN`, `WAIT`); live execution overlay; Unified Sandbox platform workflow adapter; Golden Trace Replay regression suite (100 concurrent chaos runs with random task failures). | Vitest component tests in `@unipost/console`; Golden trace replay suite verifying 100% deterministic state reproduction; full production build pass. |

---

## 6. Deep Dive Phase Specifications & Verification Gates

### Phase 26: Submodule Setup, Canonical Workflow IR & Zero-I/O PureDecider
- **Submodule Creation**: Add `<module>workflow-engine</module>` to `apps/backend/pom.xml`. Configure `workflow-engine/pom.xml` inheriting backend parent with Jackson, SQLite-JDBC, SLF4J, JUnit 5, and AssertJ.
- **Canonical IR Specifications (`workflow-ir-schema-v1.json`)**:
  - `workflowKey`: Alphanumeric slug identifier (e.g. `order-fulfillment-pipeline`).
  - `version`: Monotonically increasing revision integer.
  - `tasks`: Array of workflow tasks with `taskReferenceName`, `taskType` (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `WAIT`, etc.), `inputParameters`, `timeoutSeconds`, `retryCount`, `retryDelaySeconds`, and `backoffRate`.
  - `layoutMetadata`: Canvas coordinates (`x`, `y`) and layout node state for round-trip fidelity between visual builder and code DSL.
- **Deterministic Domain Models**:
  - `WorkflowDefinition`, `WorkflowSnapshot`, `TaskSnapshot`, `TaskStatus`, `WorkflowStatus`.
- **Zero-I/O `PureDecider`**:
  - Pure function: `DecisionResult decide(WorkflowDefinition definition, WorkflowSnapshot snapshot, long nowEpochMs)`.
  - Zero imports of `java.sql.*`, `Instant.now()`, or external frameworks.
- **Verification Gate 26**:
  - Pure JUnit 5 record-in / command-out unit test suite executing in <1ms without mocks or Spring context.
  - `mvn test -pl workflow-engine` passes 100%.

### Phase 27: Conductor Node Strategies, Topological Frontiers & Parameter Resolver
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
- **Verification Gate 27**:
  - Cycle detection tests asserting cycle path traces; parameter resolution tests evaluating `${workflow.input.*}` and `${taskRef.output.*}`; branch resolution tests.
  - `mvn test -pl workflow-engine` passes 100%.

### Phase 28: Hexagonal Engine, Single-Column Lease Queue & Storage Adapters
- **Relational Hybrid Schema**:
  - Tables: `workflow_executions`, `task_executions`, `task_queue` with composite multi-tenant index on `(tenant_id, task_type, domain, visible_at_epoch_ms, priority DESC)`.
- **Single-Column Lease Mechanism**:
  - Atomic poll via `SELECT ... WHERE tenant_id = ? AND task_type = ? AND domain = ? AND visible_at_epoch_ms <= ? ORDER BY priority DESC, visible_at_epoch_ms ASC LIMIT ? FOR UPDATE SKIP LOCKED` (or SQLite indexed query in WAL mode).
  - Atomically sets `visible_at_epoch_ms = now + responseTimeoutMs` and assigns `lease_owner`.
- **Hexagonal Ports & Storage Adapters**:
  - `PersistencePort` & `UnitOfWork` contracts.
  - `PostgresJdbcPersistenceAdapter`: Multi-tenant RLS-aware PostgreSQL adapter with `FOR UPDATE SKIP LOCKED`.
  - `SqliteJdbcPersistenceAdapter`: Pure JDBC SQLite adapter with `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;`.
  - `InMemoryPersistenceAdapter`: Thread-safe in-memory adapter for unit testing.
- **Imperative Shell (`WorkflowEngineService`)**:
  - Orchestrates transactions, triggers `PureDecider`, and runs background lease sweeping (`sweepExpiredTasks`) to detect hung workers and re-queue timed-out tasks.
- **Verification Gate 28**:
  - Multi-threaded lease contention contract test suite run against both SQLite WAL and PostgreSQL Testcontainers; worker crash lease recovery test.
  - `mvn test -pl workflow-engine` passes 100%.

### Phase 29: Virtual-Thread Worker SDK, Middleware Chain & Distributed Saga Compensation
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
- **Verification Gate 29**:
  - Automated worker test suite verifying heartbeats extending leases, `TaskOutcome.inProgress` deferrals, retry backoffs, and reverse Saga compensation traversal on terminal failures.
  - `mvn test -pl workflow-engine` passes 100%.

### Phase 30: Visual React Flow Studio, Unified Sandbox Simulator & Chaos Replay Suite
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
- **Verification Gate 30**:
  - Vitest component tests in `@unipost/console`; Golden trace replay suite verifying 100% deterministic state reproduction; full production build pass.

---

## 7. Architectural Invariants Summary

| # | Invariant | Description |
| :-: | :--- | :--- |
| **1** | **Zero-I/O Functional Core** | `PureDecider` is 100% pure and deterministic. No I/O, no system clocks, no network calls. |
| **2** | **Memento Immutability** | `definition_snapshot` freezes workflow JSON at start time. Running executions are immune to schema drift. |
| **3** | **Single-Column Lease Queue** | `visible_at_epoch_ms` governs dispatch, lease locks, async callbacks, and retry backoff. |
| **4** | **Transactional Outbox** | State transitions and queue events commit inside the exact same `UnitOfWork` database transaction. |
| **5** | **Zero-Loss Visual Round-Trip** | Visual builder edits and code DSL preserve all node attributes and `layoutMetadata` coordinates. |
| **6** | **Zero Synthetic Mocks** | Production classes, real SQLite WAL/PostgreSQL schemas, and real deciders are tested without artificial test doubles. |
| **7** | **Multi-Tenant Context** | Every workflow, execution, task, and log is strictly partitioned by `tenant_id` and `workspace_id`. |
