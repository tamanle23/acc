# System Specification: Local-First Workflow Orchestration Engine (Maven Submodule)

## 1. Objective & Core Philosophy
Design and implement a lightweight, portable, local-first workflow orchestration engine in **Java 21+** inspired by Netflix Conductor OSS, packaged as a new Maven submodule (`workflow-engine`) inside the existing multi-module Maven project.

The codebase MUST be regression-free, deterministic, and strictly organized using **Hexagonal Architecture (Ports & Adapters)**, **Functional Core / Imperative Shell**, and **Gang of Four (GoF) Design Patterns**.

---

## 2. Non-Negotiable Architectural Invariants (Guardrails)
1. **Zero-I/O Functional Core (`PureDecider`):**
   - Everything under the `core` package MUST be 100% pure, deterministic, and synchronous.
   - Classes in `core` must NEVER import `java.sql.*`, `javax.sql.*`, network clients, thread pools, Spring annotations, or call `System.currentTimeMillis()` / `Instant.now()` / `UUID.randomUUID()` directly. Pass `long nowEpochMs` and deterministic task IDs explicitly.
   - Signature: `DecisionResult decide(WorkflowDefinition definition, WorkflowSnapshot snapshot, long nowEpochMs)`.
2. **Memento Pattern for Definition Immutability:**
   - Starting a workflow MUST freeze a serialized JSON snapshot of the `WorkflowDefinition` into the persisted `workflow_executions` record (`definition_snapshot`). In-flight workflows must always evaluate against their frozen definition, never a mutable in-memory registry.
3. **Open/Closed Node Evaluation (`Strategy + Registry Pattern`):**
   - Never use monolithic `switch/if-else` blocks inside `PureDecider` to handle task node types.
   - Every node type (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `DO_WHILE`, `WAIT`) MUST implement the `NodeEvaluatorStrategy` interface and be registered in `NodeStrategyRegistry`.
4. **Transactional Outbox + Single-Column Lease Queue (`Unit of Work`):**
   - Task state updates and queue scheduling MUST occur inside a single atomic transaction (`UnitOfWork`).
   - Do not require an external Redis broker. Use a relational `task_queue` outbox table with a single unified `visible_at_epoch_ms` column that governs initial scheduling (`now`), worker lease acquisition (`now + responseTimeoutMs`), async deferral (`now + callbackAfterMs`), and retry backoff (`now + backoffMs`).
5. **Stateless Polling Workers with Middleware (`Chain of Responsibility`):**
   - Workers communicate with the engine via a pull-based `WorkerTransportPort` (`pollBatch`, `reportTaskResult`, `heartbeat`), supporting an `InProcessTransportAdapter` for local-first execution and clean extension to remote HTTP/gRPC polling.
   - Worker execution MUST run through a composable middleware chain:
     1. `SchemaValidationMiddleware` (validates input/output payloads)
     2. `AutoHeartbeatMiddleware` (extends task lease periodically on a background virtual thread while the handler is executing)
     3. `ErrorClassificationMiddleware` (maps exceptions to retryable `FAILED` vs non-retryable `FAILED_WITH_TERMINAL_ERROR`)

---

## 3. Target Directory Structure (Multi-Module Maven Layout)
Integrate the engine as a new submodule named `workflow-engine` under the existing root `pom.xml`.
- Inspect the existing root `pom.xml` first to inherit the project's `<parent>` groupId/version and `<dependencyManagement>` conventions.
- Register `<module>workflow-engine</module>` in the existing root `pom.xml` `<modules>` block without breaking any existing modules.
- Replace `<base.package>` below with the root project's base Java package (e.g., `com.unipost.workflow`).

```text
<project-root>/
├── pom.xml                                              # Existing Root POM (add <module>workflow-engine</module>)
└── workflow-engine/                                     # NEW MAVEN SUBMODULE
    ├── pom.xml                                          # Submodule POM (Jackson, SQLite-JDBC, SLF4J, JUnit 5, AssertJ)
    └── src/
        ├── main/
        │   ├── java/com/unipost/workflow/
        │   │   ├── core/                                # PURE DOMAIN CORE (Zero I/O, Zero JDBC/Framework imports)
        │   │   │   ├── model/
        │   │   │   │   ├── WorkflowDefinition.java      # Immutable Java records for DAG nodes & workflow def
        │   │   │   │   ├── WorkflowSnapshot.java        # Immutable point-in-time state of workflow + tasks
        │   │   │   │   ├── TaskSnapshot.java
        │   │   │   │   ├── TaskStatus.java              # Enum: SCHEDULED, IN_PROGRESS, COMPLETED, FAILED, etc.
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
        │   │   │   │   └── SqliteJdbcPersistenceAdapter.java # Pure JDBC + SQLite WAL mode
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
        │           └── schema-sqlite.sql                # DDL for workflow_executions, task_executions, task_queue
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
Use Java 21 `sealed interface` and `record` types to model side-effect requests emitted by `PureDecider`:
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

### 4.2 Relational + JSON Hybrid Schema (`src/main/resources/db/schema-sqlite.sql`)
Configure SQLite connections with `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;` using three core tables:
```sql
CREATE TABLE IF NOT EXISTS workflow_executions (
  workflow_id TEXT PRIMARY KEY,
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
  task_type TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'default',
  priority INTEGER NOT NULL DEFAULT 0,
  visible_at_epoch_ms INTEGER NOT NULL,
  lease_owner TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_poll 
  ON task_queue (task_type, domain, visible_at_epoch_ms, priority DESC);
```

### 4.3 Atomic Queue Polling & Lease Acquisition
When a worker polls for up to `batchSize` tasks of `taskType` in `domain` at `nowMs`:
1. Inside an explicit transaction, select eligible `task_id` rows where `task_type = ? AND domain = ? AND visible_at_epoch_ms <= ?` ordered by `priority DESC, visible_at_epoch_ms ASC LIMIT ?`.
2. Atomically update `task_queue` (`SET visible_at_epoch_ms = ? + response_timeout_ms, lease_owner = ?`) and `task_executions` (`SET status = 'IN_PROGRESS', worker_id = ?, updated_at_ms = ?`).
3. Commit the transaction and return the hydrated task payloads to the worker.

### 4.4 Simple Task Worker Contract & Developer Ergonomics (`worker/`)
Model the worker API after Netflix Conductor's `Worker` abstraction, supporting both simple POJO/Map returns and explicit state control (`callbackAfterSeconds`, terminal errors, and task logs):

1. **`TaskContext.java` (Passed to every worker invocation):**
```java
package com.unipost.workflow.worker;

import java.util.List;
import java.util.Map;

public interface TaskContext {
    String taskId();
    String workflowId();
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
```

2. **`TaskOutcome.java` (Sealed return type for full Conductor-style control):**
```java
package com.unipost.workflow.worker;

import java.util.Map;

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
```

3. **`TaskHandler.java`, `WorkerConfig.java` & Ergonomic Registration on `WorkerHost.java`:**
```java
package com.unipost.workflow.worker;

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
`WorkerHost` MUST expose two registration methods:
- `register(WorkerConfig config, TaskHandler handler)` — for tasks needing `TaskOutcome.inProgress(callbackSeconds, ...)` or custom concurrency/domain settings.
- `registerSimple(String taskType, Function<TaskContext, Map<String, Object>> fn)` — shorthand for standard synchronous tasks that return an output map directly (automatically wrapped into `TaskOutcome.completed(output)`).

---

## 5. Step-by-Step Implementation Plan (Execute Iteratively)

Execute this implementation in **5 strict phases**. At the end of each phase, run `mvn test -pl workflow-engine` and fix any compilation or test failures before advancing to the next phase.

### Phase 1: Maven Submodule Setup, Pure Domain Core & Node Strategies
- Inspect the root `pom.xml`, create `workflow-engine/pom.xml`, and register `<module>workflow-engine</module>` in the root `pom.xml`.
- Implement `ParameterResolver` supporting JSONPath-style expressions: `${workflow.input.*}` and `${<taskRef>.output.*}` (including nested maps and list indexing).
- Implement `NodeStrategyRegistry` and strategies for:
  - `SIMPLE` (initial scheduling, retry count with exponential/fixed backoff calculation, and terminal failure transition).
  - `SWITCH` (evaluates expression against `decisionCases` and schedules matching branch nodes or `defaultCase`).
  - `FORK_JOIN` (schedules parallel branch lists concurrently; blocks progression at the `JOIN` node until all required branches reach `COMPLETED`).
  - `WAIT` (halts progression until external signal or `waitUntilEpochMs` timestamp is reached).
  - `DO_WHILE` (evaluates loop condition and increments iteration counter cleanly).
- Implement `PureDecider.decide()`.
- **Verification Gate 1:** Write `PureDeciderTest.java` covering all node strategies, retry edge cases, and parameter resolution with zero mocks. Run `mvn test -pl workflow-engine` and verify 100% pass.

### Phase 2: Hexagonal Ports, Unit of Work, and In-Memory + SQLite JDBC Adapters
- Define `PersistencePort`, `UnitOfWork`, and `WorkerTransportPort`.
- Implement `InMemoryPersistenceAdapter` (using thread-safe locks/collections) and `SqliteJdbcPersistenceAdapter` (with WAL mode enabled).
- Implement the abstract JUnit 5 contract test suite (`PersistenceContractTest.java`) with concrete subclasses `InMemoryPersistenceTest` and `SqlitePersistenceTest`. Verify atomic task polling under multi-threaded worker contention, lease expiration, and transaction rollback on mid-batch failures.
- **Verification Gate 2:** Run `mvn test -pl workflow-engine` and verify both storage implementations pass the contract suite 100%.

### Phase 3: Imperative Shell (`WorkflowEngineService`) & Lease Sweeper
- Implement `WorkflowEngineService` with:
  - `startWorkflow(definition, input, domainMap)`: freezes definition Memento JSON, initializes snapshot, runs `PureDecider.decide()`, and commits initial commands in one `UnitOfWork`.
  - `reportTaskResult(result)`: validates lease ownership, handles `IN_PROGRESS` + `callbackAfterSeconds` deferral, or updates task state and triggers `PureDecider.decide()` within the same `UnitOfWork`.
  - `sweepExpiredTasks(nowEpochMs)`: finds `IN_PROGRESS` tasks whose `visible_at_epoch_ms <= nowEpochMs`, transitions them to `TIMED_OUT`, and runs `PureDecider.decide()` so retry policies trigger automatically.
- **Verification Gate 3:** Write integration tests verifying that a crashed worker (which polls a task and never reports back) has its task automatically timed out and re-scheduled for another worker once `responseTimeoutMs` elapses.

### Phase 4: Worker SDK, Virtual-Thread Poller & Middleware Chain
- Implement `TaskContext`, `TaskOutcome`, `TaskHandler`, `WorkerConfig`, and the `WorkerMiddleware` pipeline (`SchemaValidationMiddleware`, `AutoHeartbeatMiddleware`, `ErrorClassificationMiddleware`).
- Implement `WorkerHost` featuring:
  - Both `register(WorkerConfig, TaskHandler)` and `registerSimple(String, Function)` registration APIs.
  - Concurrency control per registered worker via `java.util.concurrent.Semaphore` (`maxConcurrency`) and Java 21 Virtual Threads (`Executors.newVirtualThreadPerTaskExecutor()`).
  - Adaptive polling backoff: `0ms` delay when the previous poll returned tasks (burst draining), scaling exponentially from `basePollIntervalMs` up to `maxPollIntervalMs` when queues are empty.
  - Graceful `AutoCloseable` shutdown that stops polling and awaits in-flight virtual threads before closing.
- **Verification Gate 4:** Write tests verifying both `registerSimple` and `register` (including `TaskOutcome.inProgress` deferrals and `TaskOutcome.failedTerminal`), middleware execution order, automatic heartbeating extending leases during slow tasks, and concurrency limits.

### Phase 5: Golden Trace Replay Suite & End-to-End Verification
- Create `GoldenTraceReplayTest.java` that records a multi-step workflow execution trace (including `FORK_JOIN`, `SWITCH`, a transient task failure + retry, and an async `callbackAfterSeconds` deferral) and asserts deterministic replay against `PureDecider`.
- Create `WorkflowLifecycleE2ETest.java` running a full pipeline with `SqliteJdbcPersistenceAdapter`, `InProcessTransportAdapter`, and `WorkerHost`.
- **Verification Gate 5:** Run `mvn clean test -pl workflow-engine` and ensure zero compiler warnings or test failures.